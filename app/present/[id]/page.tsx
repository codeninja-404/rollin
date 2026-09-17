'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Typography, Badge, Button, Spin, Tag, message, QRCode } from 'antd';
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  WifiOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { createClient } from '@/lib/supabase/client';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import type { AttendanceSession, Attendance } from '@/lib/types';
import dayjs from 'dayjs';

import StylishLoader from '@/components/StylishLoader';

const { Title, Text } = Typography;

export default function PresentSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [smoothProgress, setSmoothProgress] = useState(100);
  const [isFlipping, setIsFlipping] = useState(false);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [otpPeriod, setOtpPeriod] = useState(5);

  const supabase = createClient();
  const clockRef = useRef<NodeJS.Timeout | null>(null);
  const lastWindowRef = useRef<number>(-1);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const nextOtpRef = useRef<string>('');
  const isFetchingRef = useRef(false);

  // Live wall clock
  useEffect(() => {
    const updateTime = () => setCurrentTime(dayjs().format('h:mm:ss A'));
    updateTime();
    clockRef.current = setInterval(updateTime, 1000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  // Track fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Load session metadata and attendance count
  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      if (data.session?.otp_period) {
        setOtpPeriod(data.session.otp_period);
      }
      setAttendanceCount((data.attendance ?? []).length);
    } catch {
      // Ignore network abort/fetch error
    }
  }, []);

  // Fetch current OTP with cache busting
  const fetchOtp = useCallback(async (id: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch(`/api/admin/sessions/${id}/otp?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setOtp((current) => current || data.otp);
        if (data.next_otp) {
          nextOtpRef.current = data.next_otp;
        }
        if (data.period) {
          setOtpPeriod(data.period);
        }
      }
    } catch {
      // Ignore fetch error
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Continuous fluid clock-synced OTP loop (50ms interval)
  useEffect(() => {
    if (!sessionId || session?.status === 'closed') return;

    const period = Math.max(3, otpPeriod || 5);
    const periodMs = period * 1000;

    const tick = () => {
      const nowMs = Date.now();
      const currentWindow = Math.floor(nowMs / periodMs);
      const remainingMs = periodMs - (nowMs % periodMs);
      const remainingSec = Math.ceil(remainingMs / 1000);
      const progressFraction = (remainingMs / periodMs) * 100;

      setSecondsLeft(remainingSec);
      setSmoothProgress(progressFraction);

      // Trigger instant flip when TOTP window flips
      if (currentWindow !== lastWindowRef.current) {
        lastWindowRef.current = currentWindow;
        if (nextOtpRef.current) {
          setOtp(nextOtpRef.current);
          setIsFlipping(true);
          setTimeout(() => setIsFlipping(false), 240);
        }
        fetchOtp(sessionId);
      }
    };

    tick();
    tickerRef.current = setInterval(tick, 50);

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [sessionId, session?.status, fetchOtp, otpPeriod]);

  // Initial load and Realtime subscriptions with clean unmount handling
  useEffect(() => {
    let isCancelled = false;
    let attendanceChannel: ReturnType<typeof supabase.channel> | null = null;
    let sessionChannel: ReturnType<typeof supabase.channel> | null = null;

    params.then(async ({ id }) => {
      if (isCancelled) return;
      setSessionId(id);
      setLoading(true);
      await Promise.all([loadSession(id), fetchOtp(id)]);
      if (isCancelled) return;
      setLoading(false);

      const uid = Math.random().toString(36).substring(2, 9);

      // Listen for new attendance check-ins
      attendanceChannel = supabase
        .channel(`present-att-${id}-${uid}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${id}`,
        }, () => {
          if (!isCancelled) setAttendanceCount((prev) => prev + 1);
        });
      attendanceChannel.subscribe();

      // Listen for session status updates (e.g. closed by admin or period changed)
      sessionChannel = supabase
        .channel(`present-ses-${id}-${uid}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendance_sessions',
          filter: `id=eq.${id}`,
        }, (payload) => {
          if (!isCancelled && payload.new) {
            setSession((prev) => prev ? { ...prev, ...(payload.new as any) } : null);
            if ((payload.new as any).otp_period) {
              setOtpPeriod((payload.new as any).otp_period);
            }
          }
        });
      sessionChannel.subscribe();
    });

    return () => {
      isCancelled = true;
      if (attendanceChannel) supabase.removeChannel(attendanceChannel);
      if (sessionChannel) supabase.removeChannel(sessionChannel);
    };
  }, [params, loadSession, fetchOtp, supabase]);

  if (loading) {
    return (
      <AntdConfigProvider>
        <div style={{ minHeight: '100vh', background: '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <StylishLoader
            message="Connecting to Attendance Screen..."
            submessage="Synchronizing encryption keys and projector stream"
            fullScreen
          />
        </div>
      </AntdConfigProvider>
    );
  }

  if (!session) {
    return (
      <AntdConfigProvider>
        <div style={{
          minHeight: '100vh',
          background: '#FAFAFA',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#111111',
        }}>
          <CloseCircleOutlined style={{ fontSize: 48, color: '#DC2626', marginBottom: 16 }} />
          <Title level={3} style={{ color: '#111111' }}>Session Not Found</Title>
          <Text type="secondary">This attendance session does not exist or has been removed.</Text>
        </div>
      </AntdConfigProvider>
    );
  }

  const isClosed = session.status === 'closed';
  const formattedOtp = otp ? `${otp.slice(0, 3)} ${otp.slice(3)}` : '··· ···';
  const qrPayload = otp && sessionId ? JSON.stringify({ session_id: sessionId, otp }) : '';
  const isUrgent = secondsLeft <= 1;

  return (
    <AntdConfigProvider>
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#FAFAFA',
        color: '#111111',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 48px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        userSelect: 'none',
        position: 'relative',
      }}>
        {/* Top Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}>
          {/* Left: Brand + Course Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 0,
              background: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 22,
              color: '#FFFFFF',
            }}>
              R
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title level={4} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>
                  {(session.class as any)?.name ?? 'Live Attendance Session'}
                </Title>
                <Tag style={{ borderRadius: 0, fontWeight: 600, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                  {(session.class as any)?.course_code ?? 'CLASS'}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Started at {dayjs(session.started_at).format('h:mm A')} · Rollin Classroom Display
              </Text>
            </div>
          </div>

          {/* Right: Clock + Fullscreen Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              background: '#FFFFFF',
              padding: '8px 18px',
              borderRadius: 0,
              border: '1px solid #E4E4E4',
              fontFamily: 'monospace',
              fontSize: 16,
              letterSpacing: 1,
              color: '#111111',
              fontWeight: 600,
            }}>
              <ClockCircleOutlined style={{ marginRight: 8, color: '#2563EB' }} />
              {currentTime}
            </div>

            <Button
              type="text"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              style={{
                color: '#111111',
                background: '#FFFFFF',
                borderRadius: 0,
                height: 42,
                width: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #E4E4E4',
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            />
          </div>
        </div>

        {/* Center: Main OTP Presentation Body */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          zIndex: 10,
          margin: 'auto 0',
        }}>
          {!isClosed ? (
            <>
              {/* Status Pill */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                padding: '8px 22px',
                borderRadius: 0,
                marginBottom: 28,
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#16A34A',
                  display: 'inline-block',
                }} />
                <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Live Attendance Active
                </span>
              </div>

              {/* Sub-label */}
              <div style={{
                color: '#6B6B6B',
                fontSize: 16,
                letterSpacing: 2,
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: 20,
              }}>
                Scan Dynamic Attendance QR Code
              </div>

              {/* DYNAMIC HIGH-VISIBILITY ROTATING QR CODE */}
              <div style={{
                padding: 24,
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                borderRadius: 0,
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isFlipping ? 'scale(0.96)' : 'scale(1)',
                opacity: isFlipping ? 0.75 : 1,
              }}>
                <QRCode
                  value={qrPayload || 'waiting-for-session'}
                  size={320}
                  bordered={false}
                  errorLevel="L"
                  status={!otp ? 'loading' : 'active'}
                />
              </div>

              {/* Progress Countdown Bar */}
              <div style={{ width: 'min(90vw, 480px)', marginTop: 28 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  fontSize: 15,
                }}>
                  <span style={{ color: '#6B6B6B', fontWeight: 500 }}>
                    Rotating QR ({otpPeriod}s cycle)
                  </span>
                  <span style={{
                    color: isUrgent ? '#DC2626' : '#2563EB',
                    fontWeight: 800,
                    fontSize: 18,
                    fontFamily: 'monospace',
                  }}>
                    {secondsLeft}s
                  </span>
                </div>

                <div style={{
                  height: 8,
                  width: '100%',
                  background: '#E4E4E4',
                  borderRadius: 0,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${smoothProgress}%`,
                    background: isUrgent ? '#DC2626' : '#2563EB',
                    borderRadius: 0,
                    transition: 'width 0.08s linear',
                  }} />
                </div>
              </div>

              {/* Backup Code Display for Manual Fallback */}
              <div style={{
                marginTop: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                padding: '8px 20px',
                borderRadius: 0,
              }}>
                <span style={{ color: '#6B6B6B', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                  Backup Code:
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: 20,
                  letterSpacing: 4,
                  color: '#111111',
                }}>
                  {formattedOtp}
                </span>
              </div>
            </>
          ) : (
            <div style={{ padding: '60px 40px' }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 0,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: 36,
                color: '#DC2626',
              }}>
                <CloseCircleOutlined />
              </div>
              <Title level={1} style={{ color: '#111111', margin: 0, fontWeight: 800 }}>
                Attendance Closed
              </Title>
              <Text type="secondary" style={{ fontSize: 18, marginTop: 12, display: 'block' }}>
                This attendance session has ended. Submissions are no longer accepted.
              </Text>
            </div>
          )}
        </div>

        {/* Bottom Banner & Live Counter Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          background: '#FFFFFF',
          border: '1px solid #E4E4E4',
          borderRadius: 0,
          padding: '16px 28px',
          zIndex: 10,
        }}>
          {/* Network reminder */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 0,
              background: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563EB',
              fontSize: 18,
            }}>
              <WifiOutlined />
            </div>
            <div>
              <div style={{ color: '#111111', fontWeight: 600, fontSize: 15 }}>
                Campus Wi-Fi Required
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Students must be connected to authorized campus network to submit
              </Text>
            </div>
          </div>

          {/* Live Check-in Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#6B6B6B', fontWeight: 600 }}>
                SUBMITTED ATTENDANCE
              </div>
              <div style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 6,
              }}>
                <CheckCircleFilled style={{ fontSize: 18 }} />
                <span>{attendanceCount}</span>
                {totalStudents > 0 && (
                  <span style={{ color: '#6B6B6B', fontSize: 16, fontWeight: 500 }}>
                    / {totalStudents}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AntdConfigProvider>
  );
}

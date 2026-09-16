'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Typography, Badge, Button, Spin, Tag, message } from 'antd';
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

const { Title, Text } = Typography;

export default function PresentSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const supabase = createClient();
  const clockRef = useRef<NodeJS.Timeout | null>(null);

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
      setAttendanceCount((data.attendance ?? []).length);
      setTotalStudents(data.totalStudents ?? 0);
    } catch (e) {
      console.error('Failed to load session', e);
    }
  }, []);

  // Fetch current OTP with cache busting
  const fetchOtp = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${id}/otp?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setOtp(data.otp);
      }
    } catch (e) {
      console.error('Failed to fetch OTP', e);
    }
  }, []);

  // Continuous clock-synced OTP loop
  const lastWindowRef = useRef<number>(-1);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionId || session?.status === 'closed') return;

    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const currentWindow = Math.floor(nowSec / 5);
      const remaining = 5 - (nowSec % 5);

      setSecondsLeft(remaining);

      // Trigger fetch as soon as the 5-second TOTP window flips
      if (currentWindow !== lastWindowRef.current) {
        lastWindowRef.current = currentWindow;
        fetchOtp(sessionId);
      }
    };

    tick();
    tickerRef.current = setInterval(tick, 250);

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [sessionId, session?.status, fetchOtp]);

  // Initial load and Realtime subscriptions
  useEffect(() => {
    params.then(async ({ id }) => {
      setSessionId(id);
      setLoading(true);
      await loadSession(id);
      await fetchOtp(id);
      setLoading(false);

      const uid = Math.random().toString(36).substring(2, 9);

      // Listen for new attendance check-ins
      const attendanceChannel = supabase
        .channel(`present-att-${id}-${uid}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${id}`,
        }, () => {
          setAttendanceCount((prev) => prev + 1);
        })
        .subscribe();

      // Listen for session status updates (e.g. closed by admin)
      const sessionChannel = supabase
        .channel(`present-ses-${id}-${uid}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendance_sessions',
          filter: `id=eq.${id}`,
        }, (payload) => {
          if (payload.new) {
            setSession((prev) => prev ? { ...prev, ...(payload.new as any) } : null);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(attendanceChannel);
        supabase.removeChannel(sessionChannel);
      };
    });
  }, [params, loadSession, fetchOtp, supabase]);

  if (loading) {
    return (
      <AntdConfigProvider>
        <div style={{
          minHeight: '100vh',
          background: '#0a0a14',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Spin size="large" />
          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>
            Connecting to Attendance Session…
          </Text>
        </div>
      </AntdConfigProvider>
    );
  }

  if (!session) {
    return (
      <AntdConfigProvider>
        <div style={{
          minHeight: '100vh',
          background: '#0a0a14',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}>
          <CloseCircleOutlined style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }} />
          <Title level={3} style={{ color: '#fff' }}>Session Not Found</Title>
          <Text type="secondary">This attendance session does not exist or has been removed.</Text>
        </div>
      </AntdConfigProvider>
    );
  }

  const isClosed = session.status === 'closed';
  const formattedOtp = otp ? `${otp.slice(0, 3)} ${otp.slice(3)}` : '··· ···';
  const progressRatio = Math.max(0, Math.min(1, secondsLeft / 5));
  const isUrgent = secondsLeft <= 1;

  return (
    <AntdConfigProvider>
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at 50% 20%, #171836 0%, #0c0d1e 50%, #06070e 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 48px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        userSelect: 'none',
        position: 'relative',
      }}>
        {/* Background ambient lighting effects */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px',
          height: '400px',
          background: isClosed
            ? 'radial-gradient(circle, rgba(239, 68, 68, 0.08) 0%, transparent 70%)'
            : isUrgent
              ? 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          transition: 'all 0.5s ease',
        }} />

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
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 22,
              color: '#fff',
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            }}>
              R
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  {(session.class as any)?.name ?? 'Live Attendance Session'}
                </Title>
                <Tag color="#4f46e5" style={{ borderRadius: 6, fontWeight: 600, border: 'none' }}>
                  {(session.class as any)?.course_code ?? 'CLASS'}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Started at {dayjs(session.started_at).format('h:mm A')} · Rollin Classroom Display
              </Text>
            </div>
          </div>

          {/* Right: Clock + Fullscreen Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(10px)',
              padding: '8px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'monospace',
              fontSize: 16,
              letterSpacing: 1,
              color: '#e2e8f0',
              fontWeight: 600,
            }}>
              <ClockCircleOutlined style={{ marginRight: 8, color: '#818cf8' }} />
              {currentTime}
            </div>

            <Button
              type="text"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              style={{
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 12,
                height: 42,
                width: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
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
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '8px 22px',
                borderRadius: 999,
                marginBottom: 28,
              }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 12px #10b981',
                  display: 'inline-block',
                }} />
                <span style={{ color: '#34d399', fontWeight: 700, fontSize: 15, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  Live Attendance Active
                </span>
              </div>

              {/* Sub-label */}
              <div style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 18,
                letterSpacing: 2,
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: 16,
              }}>
                Enter One-Time Verification Code
              </div>

              {/* GIANT HIGH-VISIBILITY OTP */}
              <div style={{
                fontSize: 'clamp(72px, 12vw, 150px)',
                fontWeight: 900,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                letterSpacing: 'clamp(12px, 2.5vw, 32px)',
                lineHeight: 1,
                color: '#ffffff',
                textShadow: isUrgent
                  ? '0 0 50px rgba(239, 68, 68, 0.6), 0 0 100px rgba(239, 68, 68, 0.3)'
                  : '0 0 60px rgba(99, 102, 241, 0.6), 0 0 120px rgba(139, 92, 246, 0.3)',
                padding: '16px 36px',
                borderRadius: 24,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                transition: 'all 0.3s ease',
              }}>
                {formattedOtp}
              </div>

              {/* Progress Countdown Bar */}
              <div style={{ width: 'min(90vw, 680px)', marginTop: 36 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  fontSize: 16,
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                    Rotating in
                  </span>
                  <span style={{
                    color: isUrgent ? '#f87171' : '#a5b4fc',
                    fontWeight: 800,
                    fontSize: 20,
                    fontFamily: 'monospace',
                  }}>
                    {secondsLeft}s
                  </span>
                </div>

                <div style={{
                  height: 10,
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  padding: 2,
                  boxSizing: 'border-box',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progressRatio * 100}%`,
                    background: isUrgent
                      ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                      : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    borderRadius: 999,
                    transition: 'width 1s linear, background 0.3s ease',
                    boxShadow: isUrgent ? '0 0 12px #ef4444' : '0 0 12px #6366f1',
                  }} />
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '60px 40px' }}>
              <div style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: 42,
                color: '#ef4444',
              }}>
                <CloseCircleOutlined />
              </div>
              <Title level={1} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
                Attendance Closed
              </Title>
              <Text type="secondary" style={{ fontSize: 20, marginTop: 12, display: 'block' }}>
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
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '16px 28px',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}>
          {/* Network reminder */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
              fontSize: 18,
            }}>
              <WifiOutlined />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
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
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                SUBMITTED ATTENDANCE
              </div>
              <div style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 6,
              }}>
                <CheckCircleFilled style={{ fontSize: 20 }} />
                <span>{attendanceCount}</span>
                {totalStudents > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: 500 }}>
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

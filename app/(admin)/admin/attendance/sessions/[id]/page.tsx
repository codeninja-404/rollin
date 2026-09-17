'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Typography, Button, Progress, Avatar, Tag,
  Modal, Spin, Empty, Badge, Statistic, Row, Col, Space, Select, QRCode, App,
} from 'antd';
import {
  ArrowLeftOutlined, CloseCircleOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, FundProjectionScreenOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { AttendanceSession, Attendance } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';

import StylishLoader from '@/components/StylishLoader';

const { Title, Text } = Typography;

export default function SessionOtpPage({ params }: { params: Promise<{ id: string }> }) {
  const { message } = App.useApp();
  const [sessionId, setSessionId] = useState('');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [smoothProgress, setSmoothProgress] = useState(100);
  const [isFlipping, setIsFlipping] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [otpPeriod, setOtpPeriod] = useState(5);
  const [updatingPeriod, setUpdatingPeriod] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const lastWindowRef = useRef<number>(-1);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const nextOtpRef = useRef<string>('');
  const isFetchingRef = useRef(false);

  // Load session data
  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${id}`);
      const data = await res.json();
      setSession(data.session);
      if (data.session?.otp_period) {
        setOtpPeriod(data.session.otp_period);
      }
      setAttendance(data.attendance ?? []);
    } catch {
      // Ignore network abort/fetch error
    }
  }, []);

  // Fetch current OTP from server
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

  const handleUpdatePeriod = async (newPeriod: number) => {
    setUpdatingPeriod(true);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_period: newPeriod }),
      });
      if (res.ok) {
        setOtpPeriod(newPeriod);
        message.success(`OTP rotation updated to ${newPeriod}s`);
        fetchOtp(sessionId);
      } else {
        message.error('Failed to update rotation interval');
      }
    } finally {
      setUpdatingPeriod(false);
    }
  };

  // Continuous fluid clock-synced OTP loop (50ms interval for liquid-smooth progress)
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

      // As soon as the TOTP window flips, immediately transition to next_otp with zero network lag
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

  // Clean mount/unmount and Supabase Realtime subscriptions
  useEffect(() => {
    let isCancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let sessionUpdateChannel: ReturnType<typeof supabase.channel> | null = null;

    params.then(async ({ id }) => {
      if (isCancelled) return;
      setSessionId(id);
      setLoading(true);
      await Promise.all([loadSession(id), fetchOtp(id)]);
      if (isCancelled) return;
      setLoading(false);

      const uid = Math.random().toString(36).substring(2, 9);

      // Supabase Realtime — listen for new attendance records
      channel = supabase
        .channel(`session-${id}-${uid}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${id}`,
        }, () => {
          if (!isCancelled) loadSession(id);
        });
      channel.subscribe();

      // Listen for session status updates
      sessionUpdateChannel = supabase
        .channel(`session-update-${id}-${uid}`)
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
      sessionUpdateChannel.subscribe();
    });

    return () => {
      isCancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (sessionUpdateChannel) supabase.removeChannel(sessionUpdateChannel);
    };
  }, [params, loadSession, fetchOtp, supabase]);

  const handleClose = () => {
    Modal.confirm({
      title: 'Close Attendance?',
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>
            <strong>{attendance.length}</strong> of <strong>{totalStudents}</strong> students attended.
          </div>
          <Text type="secondary">
            Students who haven&apos;t submitted will see &quot;No Active Class&quot;.
          </Text>
        </div>
      ),
      okText: 'Close Attendance',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        setClosing(true);
        try {
          const res = await fetch(`/api/admin/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'closed' }),
          });
          if (res.ok) {
            message.success('Attendance session closed');
            if (tickerRef.current) clearInterval(tickerRef.current);
            router.push('/admin/attendance');
          } else {
            const data = await res.json();
            message.error(data.error ?? 'Failed to close');
          }
        } finally {
          setClosing(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <AntdConfigProvider>
        <StylishLoader
          message="Connecting to attendance session..."
          submessage="Synchronizing encryption keys and student roster"
          minHeight="65vh"
        />
      </AntdConfigProvider>
    );
  }
  if (!session) return <Empty description="Session not found" />;

  const isClosed = session.status === 'closed';
  const progressPercent = totalStudents > 0 ? Math.round((attendance.length / totalStudents) * 100) : 0;

  // Format OTP with space in middle for readability
  const formattedOtp = otp ? `${otp.slice(0, 3)} ${otp.slice(3)}` : '···  ···';
  const qrPayload = otp && sessionId ? JSON.stringify({ session_id: sessionId, otp }) : '';

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/admin/attendance')}
            style={{ color: '#111111', borderRadius: 0 }}
          >
            Back
          </Button>

          {!isClosed && (
            <Button
              type="primary"
              icon={<FundProjectionScreenOutlined />}
              onClick={() => window.open(`/present/${sessionId}`, '_blank')}
              style={{
                background: '#2563EB',
                borderColor: '#2563EB',
                borderRadius: 0,
                height: 36,
                fontWeight: 600,
              }}
            >
              Share Screen (Projector View)
            </Button>
          )}
        </div>

        <Row gutter={[24, 24]}>
          {/* Left — OTP Display */}
          <Col xs={24} lg={12}>
            <Card
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                borderRadius: 0,
                textAlign: 'center',
                height: '100%',
              }}
              styles={{ body: { padding: '32px 24px' } }}
            >
              {/* Class info */}
              <div style={{ marginBottom: 32 }}>
                <Tag color="blue" style={{ borderRadius: 0, marginBottom: 8 }}>
                  {(session.class as any)?.course_code}
                </Tag>
                <Title level={3} style={{ color: '#111111', margin: 0 }}>
                  {(session.class as any)?.name}
                </Title>
                <div style={{ marginTop: 8 }}>
                  {isClosed ? (
                    <Badge status="default" text={<Text style={{ color: '#6B6B6B' }}>Closed</Text>} />
                  ) : (
                    <Badge status="processing" color="#16A34A" text={<Text style={{ color: '#16A34A', fontWeight: 600 }}>Attendance Open</Text>} />
                  )}
                </div>
              </div>

              {/* OTP */}
              {/* Dynamic Rotating QR Code */}
              {!isClosed && (
                <>
                  <div style={{
                    padding: 16,
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18,
                    transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isFlipping ? 'scale(0.96)' : 'scale(1)',
                    opacity: isFlipping ? 0.75 : 1,
                  }}>
                    <QRCode
                      value={qrPayload || 'waiting-for-session'}
                      size={220}
                      bordered={false}
                      errorLevel="L"
                      status={!otp ? 'loading' : 'active'}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 12,
                  }}>
                    <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                      Code:
                    </Text>
                    <Text style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: 3,
                      color: '#111111',
                    }}>
                      {formattedOtp}
                    </Text>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Rotates in{' '}
                      <Text style={{ color: secondsLeft <= 2 ? '#DC2626' : '#2563EB', fontWeight: 700 }}>
                        {secondsLeft}s
                      </Text>
                      {' '}(every {otpPeriod}s)
                    </Text>
                  </div>

                  <Progress
                    percent={smoothProgress}
                    showInfo={false}
                    strokeColor={secondsLeft <= 2 ? '#DC2626' : '#2563EB'}
                    railColor="#E4E4E4"
                    style={{ marginBottom: 20 }}
                  />

                  {/* Live interval adjustment */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#FAFAFA',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    padding: '6px 14px',
                    marginBottom: 28,
                  }}>
                    <span style={{ color: '#6B6B6B', fontSize: 13, fontWeight: 500 }}>
                      Rotation Speed:
                    </span>
                    <Select
                      size="small"
                      value={otpPeriod}
                      loading={updatingPeriod}
                      onChange={handleUpdatePeriod}
                      style={{ width: 125 }}
                      options={[
                        { label: '5s (Ultra)', value: 5 },
                        { label: '10s (Standard)', value: 10 },
                        { label: '15s (Relaxed)', value: 15 },
                        { label: '30s (Slow)', value: 30 },
                        { label: '60s (1 min)', value: 60 },
                      ]}
                    />
                  </div>
                </>
              )}

              {/* Session time */}
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary">
                  Started {dayjs(session.started_at).format('h:mm A')}
                  {session.ended_at && ` · Ended ${dayjs(session.ended_at).format('h:mm A')}`}
                </Text>
              </div>

              {/* Actions */}
              {!isClosed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                  <Button
                    icon={<FundProjectionScreenOutlined />}
                    size="large"
                    onClick={() => window.open(`/present/${sessionId}`, '_blank')}
                    style={{
                      borderRadius: 0,
                      height: 42,
                      width: '100%',
                      fontWeight: 600,
                      background: '#FFFFFF',
                      borderColor: '#E4E4E4',
                      color: '#111111',
                    }}
                  >
                    Open in New Tab (No Sidebar)
                  </Button>

                  <Button
                    danger
                    type="primary"
                    icon={<CloseCircleOutlined />}
                    size="large"
                    loading={closing}
                    onClick={handleClose}
                    style={{ borderRadius: 0, height: 42, width: '100%', fontWeight: 600 }}
                  >
                    Close Attendance
                  </Button>
                </div>
              )}
            </Card>
          </Col>

          {/* Right — Live attendance */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong style={{ color: '#111111' }}>Live Attendance</Text>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    size="small"
                    onClick={() => loadSession(sessionId)}
                    style={{ color: '#6B6B6B' }}
                  />
                </div>
              }
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                borderRadius: 0,
                height: '100%',
              }}
              styles={{
                header: { borderBottom: '1px solid #E4E4E4' },
                body: { padding: '20px 24px' },
              }}
            >
              {/* Count */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                marginBottom: 20,
                padding: '16px 20px',
                background: '#FAFAFA',
                border: '1px solid #E4E4E4',
                borderRadius: 0,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#16A34A', lineHeight: 1 }}>
                    {attendance.length}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Present</Text>
                </div>
                <div style={{ color: '#E4E4E4', fontSize: 28 }}>/</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#111111', lineHeight: 1 }}>
                    {totalStudents}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Total</Text>
                </div>
                <div style={{ flex: 1 }}>
                  <Progress
                    type="circle"
                    percent={progressPercent}
                    size={64}
                    strokeColor="#2563EB"
                    railColor="#E4E4E4"
                    format={(p) => <Text style={{ color: '#111111', fontSize: 13, fontWeight: 700 }}>{p}%</Text>}
                  />
                </div>
              </div>

              {/* Student list */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {attendance.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <Text type="secondary">Waiting for students…</Text>
                  </div>
                ) : (
                  attendance.map((record) => (
                    <div
                      key={record.id}
                      style={{
                        padding: '10px 0',
                        borderBottom: '1px solid #E4E4E4',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                      }}
                    >
                      <Avatar
                        size={32}
                        style={{ background: '#2563EB', borderRadius: 0, flexShrink: 0 }}
                      >
                        {(record.student as any)?.name?.charAt(0) ?? '?'}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#111111', fontWeight: 600, fontSize: 14 }}>
                          {(record.student as any)?.name ?? 'Unknown'}
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {(record.student as any)?.student_code}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <CheckCircleOutlined style={{ color: '#16A34A', fontSize: 16 }} />
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(record.marked_at).format('h:mm:ss A')}
                          </Text>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </AntdConfigProvider>
  );
}

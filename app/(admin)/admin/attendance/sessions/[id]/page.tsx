'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Typography, Button, Progress, Avatar, Tag, List,
  Modal, message, Spin, Empty, Badge, Statistic, Row, Col,
} from 'antd';
import {
  ArrowLeftOutlined, CloseCircleOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { AttendanceSession, Attendance } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;

export default function SessionOtpPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState('');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const otpIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Load session data
  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/sessions/${id}`);
    const data = await res.json();
    setSession(data.session);
    setAttendance(data.attendance ?? []);
    setTotalStudents(data.totalStudents ?? 0);
  }, []);

  // Fetch current OTP from server
  const fetchOtp = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/sessions/${id}/otp`);
    const data = await res.json();
    if (res.ok) {
      setOtp(data.otp);
      setSecondsLeft(data.seconds_remaining);
    }
  }, []);

  // Countdown timer
  const startCountdown = useCallback((initialSeconds: number, id: string) => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    let secs = initialSeconds;
    countdownRef.current = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        clearInterval(countdownRef.current!);
        fetchOtp(id).then(() => {});
      } else {
        setSecondsLeft(secs);
      }
    }, 1000);
  }, [fetchOtp]);

  useEffect(() => {
    params.then(async ({ id }) => {
      setSessionId(id);
      setLoading(true);
      await loadSession(id);
      const res = await fetch(`/api/admin/sessions/${id}/otp`);
      const data = await res.json();
      if (res.ok) {
        setOtp(data.otp);
        setSecondsLeft(data.seconds_remaining);
        startCountdown(data.seconds_remaining, id);
      }
      setLoading(false);

      // Supabase Realtime — listen for new attendance records
      const channel = supabase
        .channel(`session-${id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${id}`,
        }, () => {
          loadSession(id);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [params, loadSession, fetchOtp, startCountdown, supabase]);

  // Restart countdown when secondsLeft hits 0 and OTP is refreshed
  useEffect(() => {
    if (secondsLeft > 0 && sessionId) {
      // already handled in startCountdown
    }
  }, [otp, secondsLeft, sessionId]);

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
            if (countdownRef.current) clearInterval(countdownRef.current);
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

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!session) return <Empty description="Session not found" />;

  const isClosed = session.status === 'closed';
  const progressPercent = totalStudents > 0 ? Math.round((attendance.length / totalStudents) * 100) : 0;

  // Format OTP with space in middle for readability
  const formattedOtp = otp ? `${otp.slice(0, 3)} ${otp.slice(3)}` : '···  ···';

  return (
    <AntdConfigProvider>
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/admin/attendance')}
          style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}
        >
          Back
        </Button>

        <Row gutter={[24, 24]}>
          {/* Left — OTP Display */}
          <Col xs={24} lg={12}>
            <Card
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 20,
                textAlign: 'center',
                height: '100%',
              }}
              styles={{ body: { padding: 40 } }}
            >
              {/* Class info */}
              <div style={{ marginBottom: 32 }}>
                <Tag color="blue" style={{ borderRadius: 6, marginBottom: 8 }}>
                  {(session.class as any)?.course_code}
                </Tag>
                <Title level={3} style={{ color: '#fff', margin: 0 }}>
                  {(session.class as any)?.name}
                </Title>
                <div style={{ marginTop: 8 }}>
                  {isClosed ? (
                    <Badge status="default" text={<Text style={{ color: '#9ca3af' }}>Closed</Text>} />
                  ) : (
                    <Badge status="processing" color="#10b981" text={<Text style={{ color: '#34d399' }}>Attendance Open</Text>} />
                  )}
                </div>
              </div>

              {/* OTP */}
              {!isClosed && (
                <>
                  <div style={{
                    fontSize: 72,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: 12,
                    fontFamily: 'monospace',
                    lineHeight: 1,
                    marginBottom: 16,
                    textShadow: '0 0 40px rgba(99,102,241,0.5)',
                  }}>
                    {formattedOtp}
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <Text type="secondary" style={{ fontSize: 15 }}>
                      Changes in{' '}
                      <Text style={{ color: secondsLeft <= 2 ? '#ef4444' : '#818cf8', fontWeight: 700 }}>
                        {secondsLeft}s
                      </Text>
                    </Text>
                  </div>

                  <Progress
                    percent={(secondsLeft / 5) * 100}
                    showInfo={false}
                    strokeColor={secondsLeft <= 2 ? '#ef4444' : '#6366f1'}
                    trailColor="rgba(255,255,255,0.1)"
                    style={{ marginBottom: 32 }}
                  />
                </>
              )}

              {/* Session time */}
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary">
                  Started {dayjs(session.started_at).format('h:mm A')}
                  {session.ended_at && ` · Ended ${dayjs(session.ended_at).format('h:mm A')}`}
                </Text>
              </div>

              {/* Close button */}
              {!isClosed && (
                <Button
                  danger
                  type="primary"
                  icon={<CloseCircleOutlined />}
                  size="large"
                  loading={closing}
                  onClick={handleClose}
                  style={{ borderRadius: 12, height: 48, width: '100%', fontWeight: 600 }}
                >
                  Close Attendance
                </Button>
              )}
            </Card>
          </Col>

          {/* Right — Live attendance */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong style={{ color: '#fff' }}>Live Attendance</Text>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    size="small"
                    onClick={() => loadSession(sessionId)}
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  />
                </div>
              }
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                height: '100%',
              }}
              styles={{
                header: { borderBottom: '1px solid rgba(255,255,255,0.08)' },
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
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
                    {attendance.length}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Present</Text>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 28 }}>/</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                    {totalStudents}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Total</Text>
                </div>
                <div style={{ flex: 1 }}>
                  <Progress
                    type="circle"
                    percent={progressPercent}
                    size={64}
                    strokeColor="#6366f1"
                    trailColor="rgba(255,255,255,0.1)"
                    format={(p) => <Text style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{p}%</Text>}
                  />
                </div>
              </div>

              {/* Student list */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                <List
                  dataSource={attendance}
                  locale={{ emptyText: <Text type="secondary">Waiting for students…</Text> }}
                  renderItem={(record) => (
                    <List.Item style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                        <Avatar
                          size={32}
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', flexShrink: 0 }}
                        >
                          {(record.student as any)?.name?.charAt(0) ?? '?'}
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                            {(record.student as any)?.name ?? 'Unknown'}
                          </div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {(record.student as any)?.student_code}
                          </Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <CheckCircleOutlined style={{ color: '#34d399', fontSize: 16 }} />
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {dayjs(record.marked_at).format('h:mm:ss A')}
                            </Text>
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </AntdConfigProvider>
  );
}

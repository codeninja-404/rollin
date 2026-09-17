'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Button, Input, Typography, Alert, Badge, Tag, Space,
} from 'antd';
import {
  CheckCircleFilled, ClockCircleOutlined, BookOutlined,
  LogoutOutlined, LockOutlined, ScanOutlined, ReloadOutlined,
  WifiOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { ActiveSessionResponse } from '@/lib/types';
import dayjs from 'dayjs';
import StylishLoader from '@/components/StylishLoader';
import QrScannerDrawer from '@/components/QrScannerDrawer';

const { Title, Text } = Typography;

export default function AttendancePage() {
  const [state, setState] = useState<ActiveSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const realtimeRef = useRef<any>(null);

  const loadState = useCallback(async (targetSessionId?: string) => {
    try {
      const url = targetSessionId ? `/api/attendance/session?session_id=${targetSessionId}` : '/api/attendance/session';
      const res = await fetch(url);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setState(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadState();

    const uid = Math.random().toString(36).substring(2, 9);

    // Realtime — listen for session status changes
    const channel = supabase
      .channel(`student-att-sessions-${uid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_sessions',
      }, () => {
        loadState();
      })
      .subscribe();

    realtimeRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadState, supabase]);

  const handleSubmit = async (overrideOtp?: string, overrideSessionId?: string) => {
    const code = (overrideOtp || otp).trim();
    if (!code || code.length !== 6) {
      setError('Please enter or scan a valid 6-digit code.');
      return;
    }
    const targetSessionId = overrideSessionId || state?.session?.id;
    if (!targetSessionId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: targetSessionId, otp: code }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        loadState(targetSessionId); // Refresh to show "already attended" state for this session
      } else {
        setError(data.error ?? 'Submission failed. Please try again.');
      }
    } catch {
      setError('Network connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanSuccess = async (data: { sessionId?: string; otp: string }) => {
    setScannerOpen(false);

    const targetSessionId = data.sessionId || state?.session?.id;
    if (!targetSessionId) {
      setError('No active session found.');
      return;
    }

    setOtp(data.otp);
    await handleSubmit(data.otp, targetSessionId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <StylishLoader
        message="Checking active attendance..."
        submessage="Connecting to campus network and session status"
        fullScreen
      />
    );
  }

  const { session, already_attended, attendance } = state ?? {};
  const hasSession = !!session;
  const isDone = already_attended || success;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#FAFAFA',
    }}>
      {/* Top Application Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 60,
        background: '#FFFFFF',
        borderBottom: '1px solid #E4E4E4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            background: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BookOutlined style={{ color: '#FFFFFF', fontSize: 16 }} />
          </div>
          <div>
            <Text strong style={{ color: '#111111', fontSize: 15, display: 'block', lineHeight: 1.2 }}>
              Rollin
            </Text>
            <span style={{ fontSize: 11, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              Live Sync
            </span>
          </div>
        </div>

        <Space size={12}>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleSignOut}
            style={{ color: '#6B6B6B', fontSize: 13, borderRadius: 0 }}
          >
            Sign Out
          </Button>
        </Space>
      </header>

      {/* Main Container */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px 16px 40px',
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
      }}>
        {/* State 1: No active class */}
        {!hasSession && (
          <Card
            style={{
              width: '100%',
              background: '#FFFFFF',
              border: '1px solid #E4E4E4',
              borderRadius: 0,
              textAlign: 'center',
            }}
            styles={{ body: { padding: '40px 24px' } }}
          >
            <div style={{
              width: 64,
              height: 64,
              background: '#F4F4F5',
              border: '1px solid #E4E4E4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 26,
            }}>
              <ClockCircleOutlined style={{ color: '#6B6B6B' }} />
            </div>

            <Title level={4} style={{ color: '#111111', margin: '0 0 8px', fontWeight: 700 }}>
              No Active Class
            </Title>
            <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, lineHeight: 1.5 }}>
              There is currently no attendance session open for your enrolled classes. This screen updates in real time once your lecturer opens check-in.
            </Text>

            <div style={{
              background: '#FAFAFA',
              border: '1px solid #E4E4E4',
              padding: '10px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 24,
            }}>
              <WifiOutlined style={{ color: '#16A34A', fontSize: 14 }} />
              <Text style={{ fontSize: 12, color: '#4B5563' }}>
                Connected to Campus Network &bull; Auto-sync active
              </Text>
            </div>

            <div>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => loadState()}
                style={{
                  borderRadius: 0,
                  height: 38,
                  fontWeight: 500,
                  color: '#2563EB',
                  borderColor: '#BFDBFE',
                }}
              >
                Check for Session
              </Button>
            </div>
          </Card>
        )}

        {/* State 2: Attendance open, not attended */}
        {hasSession && !isDone && (
          <Card
            style={{
              width: '100%',
              background: '#FFFFFF',
              border: '1px solid #E4E4E4',
              borderRadius: 0,
              boxShadow: 'none',
              textAlign: 'center',
            }}
            styles={{ body: { padding: '32px 24px' } }}
          >
            {/* Status indicator */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              padding: '4px 14px',
              marginBottom: 20,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              <Text style={{ color: '#16A34A', fontWeight: 700, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Live Attendance Open
              </Text>
            </div>

            {/* Course & Class Info */}
            <div style={{
              background: '#FAFAFA',
              border: '1px solid #E4E4E4',
              padding: '20px 18px',
              marginBottom: 24,
              textAlign: 'center',
            }}>
              <Tag
                style={{
                  background: '#EFF6FF',
                  color: '#2563EB',
                  border: '1px solid #BFDBFE',
                  fontWeight: 700,
                  fontSize: 12,
                  marginBottom: 8,
                  borderRadius: 0,
                }}
              >
                {(session!.class as any)?.course_code}
              </Tag>
              <Title level={3} style={{ color: '#111111', margin: '4px 0 6px', fontWeight: 700 }}>
                {(session!.class as any)?.name}
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Session started at {dayjs(session!.started_at).format('h:mm A')}
              </Text>
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                style={{ borderRadius: 0, marginBottom: 20, textAlign: 'left' }}
                closable
                onClose={() => setError(null)}
              />
            )}

            {/* Primary Action: Open Bottom Drawer Scanner */}
            <Button
              type="primary"
              size="large"
              icon={<ScanOutlined style={{ fontSize: 22 }} />}
              onClick={() => setScannerOpen(true)}
              loading={submitting}
              style={{
                width: '100%',
                height: 52,
                fontSize: 16,
                fontWeight: 600,
                background: '#2563EB',
                borderColor: '#2563EB',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              Scan Attendance QR
            </Button>

            <div style={{ marginBottom: 20 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Opens camera drawer to scan the rotating QR projected in class.
              </Text>
            </div>

            {/* Manual Code Fallback Drawer Trigger or Section */}
            <div style={{ borderTop: '1px solid #E4E4E4', paddingTop: 16 }}>
              {!showManualInput ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setShowManualInput(true)}
                  style={{ color: '#6B6B6B', fontSize: 13, padding: 0 }}
                >
                  Camera not working? Enter code manually →
                </Button>
              ) : (
                <div style={{ textAlign: 'left', marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ color: '#4B5563', fontSize: 13, fontWeight: 500 }}>
                      Enter 6-digit backup code
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => setShowManualInput(false)}
                      style={{ color: '#6B6B6B', fontSize: 12, height: 'auto', padding: 0 }}
                    >
                      Hide
                    </Button>
                  </div>

                  <Input
                    value={otp}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(v);
                    }}
                    placeholder="• • • • • •"
                    maxLength={6}
                    size="large"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E4E4E4',
                      borderRadius: 0,
                      color: '#111111',
                      fontSize: 22,
                      letterSpacing: 8,
                      textAlign: 'center',
                      height: 48,
                      marginBottom: 12,
                      fontFamily: 'monospace',
                    }}
                    prefix={<LockOutlined style={{ color: '#6B6B6B' }} />}
                    onPressEnter={() => handleSubmit()}
                  />

                  <Button
                    type="default"
                    size="large"
                    block
                    loading={submitting}
                    disabled={otp.length !== 6}
                    onClick={() => handleSubmit()}
                    style={{
                      height: 42,
                      borderRadius: 0,
                      fontWeight: 600,
                    }}
                  >
                    Submit Code
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* State 3: Already attended / success */}
        {hasSession && isDone && (
          <Card
            style={{
              width: '100%',
              background: '#FFFFFF',
              border: '1px solid #E4E4E4',
              borderRadius: 0,
              boxShadow: 'none',
              textAlign: 'center',
            }}
            styles={{ body: { padding: '40px 24px' } }}
          >
            <div style={{
              width: 68,
              height: 68,
              borderRadius: 0,
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircleFilled style={{ color: '#16A34A', fontSize: 36 }} />
            </div>

            <Title level={3} style={{ color: '#111111', margin: '0 0 4px', fontWeight: 800 }}>
              Attendance Recorded
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Your check-in has been validated and recorded on the server.
            </Text>

            <div style={{
              background: '#FAFAFA',
              border: '1px solid #E4E4E4',
              padding: '18px 20px',
              margin: '24px 0',
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text strong style={{ color: '#111111', fontSize: 16 }}>
                  {(session!.class as any)?.name}
                </Text>
                <Tag color="green" style={{ borderRadius: 0, fontWeight: 600 }}>
                  Present
                </Tag>
              </div>

              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                {(session!.class as any)?.course_code}
              </Text>

              <div style={{ borderTop: '1px solid #E4E4E4', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6B6B6B' }}>Marked At:</span>
                <span style={{ fontWeight: 600, color: '#111111' }}>
                  {(attendance as any)?.marked_at
                    ? dayjs((attendance as any).marked_at).format('h:mm:ss A')
                    : dayjs().format('h:mm:ss A')}
                </span>
              </div>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#6B6B6B',
            }}>
              <SafetyCertificateOutlined style={{ color: '#16A34A' }} />
              Verified with cryptographic rotating QR & campus network
            </div>
          </Card>
        )}
      </main>

      {/* Bottom Drawer Scanner (Opens smoothly from the bottom) */}
      <QrScannerDrawer
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanSuccess}
        onSwitchToManual={() => {
          setScannerOpen(false);
          setShowManualInput(true);
        }}
      />
    </div>
  );
}

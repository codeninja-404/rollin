'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, Button, Input, Typography, Alert, Spin, Avatar,
  Badge, Space,
} from 'antd';
import {
  CheckCircleFilled, ClockCircleOutlined, BookOutlined,
  LogoutOutlined, LockOutlined,
} from '@ant-design/icons';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { ActiveSessionResponse } from '@/lib/types';
import dayjs from 'dayjs';
import StylishLoader from '@/components/StylishLoader';

const { Title, Text } = Typography;

export default function AttendancePage() {
  const [state, setState] = useState<ActiveSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const realtimeRef = useRef<any>(null);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/session');
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

    // Realtime — listen for new open sessions
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

  const handleSubmit = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter a 6-digit OTP.');
      return;
    }
    if (!state?.session) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: state.session.id, otp: otp.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        loadState(); // Refresh to show "already attended" state
      } else {
        setError(data.error ?? 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
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
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      background: '#FAFAFA',
    }}>
      {/* Header */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, background: '#FFFFFF', borderBottom: '1px solid #E4E4E4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 0, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOutlined style={{ color: '#FFFFFF', fontSize: 16 }} />
          </div>
          <Text strong style={{ color: '#111111', fontSize: 15 }}>Rollin</Text>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={handleSignOut}
          style={{ color: '#6B6B6B', borderRadius: 0 }}
        >
          Sign Out
        </Button>
      </div>

      {/* Main card */}
      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#FFFFFF',
          border: '1px solid #E4E4E4',
          borderRadius: 0,
          boxShadow: 'none',
          textAlign: 'center',
          marginTop: 60,
        }}
        styles={{ body: { padding: 36 } }}
      >
        {/* State 1: No active class */}
        {!hasSession && (
          <div>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 0,
              background: '#FAFAFA',
              border: '1px solid #E4E4E4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28,
            }}>
              <ClockCircleOutlined style={{ color: '#6B6B6B' }} />
            </div>
            <Title level={3} style={{ color: '#111111', margin: '0 0 8px' }}>
              No Active Class
            </Title>
            <Text type="secondary">
              There is currently no attendance open for you.
              Check back when your lecturer starts the session.
            </Text>
            <div style={{ marginTop: 24 }}>
              <Button
                type="text"
                size="small"
                onClick={loadState}
                style={{ color: '#2563EB', borderRadius: 0 }}
              >
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* State 2: Attendance open, not attended */}
        {hasSession && !isDone && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <Badge status="processing" color="#16A34A" />
              <Text style={{ color: '#16A34A', fontWeight: 600, marginLeft: 8 }}>
                Attendance Open
              </Text>
            </div>

            <div style={{
              background: '#FAFAFA',
              borderRadius: 0,
              padding: '16px 20px',
              marginBottom: 24,
              border: '1px solid #E4E4E4',
            }}>
              <Title level={3} style={{ color: '#111111', margin: '0 0 4px' }}>
                {(session!.class as any)?.name}
              </Title>
              <Text type="secondary">{(session!.class as any)?.course_code}</Text>
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                style={{ borderRadius: 0, marginBottom: 16, textAlign: 'left' }}
                closable
                onClose={() => setError(null)}
              />
            )}

            <div style={{ marginBottom: 8, textAlign: 'left' }}>
              <Text style={{ color: '#6B6B6B', fontSize: 13 }}>
                Enter the 6-digit OTP shown in class
              </Text>
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
                fontSize: 24,
                letterSpacing: 10,
                textAlign: 'center',
                height: 52,
                marginBottom: 16,
                fontFamily: 'monospace',
              }}
              prefix={<LockOutlined style={{ color: '#6B6B6B' }} />}
              onPressEnter={handleSubmit}
            />

            <Button
              type="primary"
              size="large"
              block
              loading={submitting}
              disabled={otp.length !== 6}
              onClick={handleSubmit}
              style={{
                height: 44,
                borderRadius: 0,
                fontSize: 15,
                fontWeight: 600,
                background: '#2563EB',
                borderColor: '#2563EB',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit Attendance'}
            </Button>
          </div>
        )}

        {/* State 3: Already attended / success */}
        {hasSession && isDone && (
          <div>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 0,
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircleFilled style={{ color: '#16A34A', fontSize: 32 }} />
            </div>
            <Title level={3} style={{ color: '#111111', margin: '0 0 8px' }}>
              ✓ Attendance Done
            </Title>
            <div style={{
              background: '#FAFAFA',
              borderRadius: 0,
              padding: '16px 20px',
              margin: '16px 0',
              border: '1px solid #E4E4E4',
            }}>
              <Text strong style={{ color: '#111111', fontSize: 16 }}>
                {(session!.class as any)?.name}
              </Text>
              <div>
                <Text type="secondary">{(session!.class as any)?.course_code}</Text>
              </div>
            </div>
            {(attendance as any)?.marked_at && (
              <Text type="secondary">
                Submitted at {dayjs((attendance as any).marked_at).format('h:mm:ss A')}
              </Text>
            )}
            {!attendance && success && (
              <Text type="secondary">
                Your attendance has been recorded.
              </Text>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

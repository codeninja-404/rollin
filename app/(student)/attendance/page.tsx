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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
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
    }}>
      {/* Decorative blobs */}
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-15%', left: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <Text strong style={{ color: '#fff', fontSize: 16 }}>Rollin</Text>
        </div>
        <Button
          type="text"
          icon={<LogoutOutlined />}
          onClick={handleSignOut}
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          Sign Out
        </Button>
      </div>

      {/* Main card */}
      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}
        styles={{ body: { padding: 40 } }}
      >
        {/* State 1: No active class */}
        {!hasSession && (
          <div>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 32,
            }}>
              <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />
            </div>
            <Title level={3} style={{ color: '#fff', margin: '0 0 8px' }}>
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
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* State 2: Attendance open, not attended */}
        {hasSession && !isDone && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Badge status="processing" color="#10b981" />
              <Text style={{ color: '#34d399', fontWeight: 600, marginLeft: 8 }}>
                Attendance Open
              </Text>
            </div>

            <div style={{
              background: 'rgba(99,102,241,0.1)',
              borderRadius: 14,
              padding: '16px 20px',
              marginBottom: 28,
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Title level={3} style={{ color: '#fff', margin: '0 0 4px' }}>
                {(session!.class as any)?.name}
              </Title>
              <Text type="secondary">{(session!.class as any)?.course_code}</Text>
            </div>

            {error && (
              <Alert
                message={error}
                type="error"
                style={{ borderRadius: 10, marginBottom: 16, textAlign: 'left' }}
                closable
                onClose={() => setError(null)}
              />
            )}

            <div style={{ marginBottom: 8, textAlign: 'left' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
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
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#fff',
                fontSize: 28,
                letterSpacing: 12,
                textAlign: 'center',
                height: 60,
                marginBottom: 16,
                fontFamily: 'monospace',
              }}
              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
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
                height: 52,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border: 'none',
                boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
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
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircleFilled style={{ color: '#34d399', fontSize: 40 }} />
            </div>
            <Title level={3} style={{ color: '#fff', margin: '0 0 8px' }}>
              ✓ Attendance Done
            </Title>
            <div style={{
              background: 'rgba(99,102,241,0.1)',
              borderRadius: 14,
              padding: '16px 20px',
              margin: '16px 0',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Text strong style={{ color: '#fff', fontSize: 16 }}>
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

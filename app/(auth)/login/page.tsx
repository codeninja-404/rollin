'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Segmented, message } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  BookOutlined,
  IdcardOutlined,
  MailOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'activate'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const [loginForm] = Form.useForm();
  const [activateForm] = Form.useForm();

  // Regular Sign In
  const onSignIn = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid credentials. If this is your first time logging in, please click "Activate Account" above to set your password.');
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  // Student Self-Activation
  const onActivate = async (values: {
    student_code: string;
    email: string;
    password: string;
    confirm_password: string;
  }) => {
    if (values.password !== values.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_code: values.student_code,
          email: values.email,
          password: values.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Activation failed');
        setLoading(false);
        return;
      }

      setSuccessMsg(`Welcome, ${data.name || 'Student'}! Logging you in...`);

      // Automatically sign the student in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (signInError) {
        message.success('Account activated! Please sign in with your new password.');
        setMode('signin');
        loginForm.setFieldsValue({ email: values.email });
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('An unexpected error occurred during activation.');
      setLoading(false);
    }
  };

  return (
    <AntdConfigProvider>
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          position: 'relative',
        }}
      >
        {/* Decorative blobs */}
        <div style={{
          position: 'fixed', top: '-20%', right: '-10%',
          width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'fixed', bottom: '-15%', left: '-10%',
          width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <Card
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            boxShadow: 'none',
          }}
          styles={{ body: { padding: '36px 32px' } }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 0,
              background: '#2563EB',
              marginBottom: 12,
            }}>
              <BookOutlined style={{ fontSize: 24, color: '#FFFFFF' }} />
            </div>
            <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700, letterSpacing: -0.5 }}>
              Rollin
            </Title>
            <Text style={{ color: '#6B6B6B', fontSize: 13 }}>
              Class Attendance System
            </Text>
          </div>

          {/* Mode Selector */}
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <Segmented
              block
              value={mode}
              onChange={(val) => {
                setMode(val as 'signin' | 'activate');
                setError(null);
                setSuccessMsg(null);
              }}
              options={[
                { label: 'Sign In', value: 'signin' },
                { label: 'Activate Account', value: 'activate' },
              ]}
              style={{
                background: '#F4F4F5',
                padding: 4,
                borderRadius: 0,
              }}
            />
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              style={{ marginBottom: 20, borderRadius: 0 }}
              closable
              onClose={() => setError(null)}
            />
          )}

          {successMsg && (
            <Alert
              message={successMsg}
              type="success"
              icon={<CheckCircleOutlined />}
              showIcon
              style={{ marginBottom: 20, borderRadius: 0 }}
            />
          )}

          {mode === 'signin' ? (
            /* ================= SIGN IN FORM ================= */
            <Form
              form={loginForm}
              name="login"
              onFinish={onSignIn}
              layout="vertical"
              requiredMark={false}
              size="large"
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#6B6B6B' }} />}
                  placeholder="University Email Address"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    color: '#111111',
                    height: 44,
                  }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#6B6B6B' }} />}
                  placeholder="Password"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    color: '#111111',
                    height: 44,
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{
                    height: 44,
                    borderRadius: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    background: '#2563EB',
                    borderColor: '#2563EB',
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: '#6B6B6B', fontSize: 13 }}>
                  First time logging in?{' '}
                  <a
                    onClick={() => {
                      setMode('activate');
                      setError(null);
                    }}
                    style={{ color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Activate your account
                  </a>
                </Text>
              </div>
            </Form>
          ) : (
            /* ================= SELF ACTIVATION FORM ================= */
            <Form
              form={activateForm}
              name="activate"
              onFinish={onActivate}
              layout="vertical"
              requiredMark={false}
              size="large"
            >
              <div style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 0,
                padding: '12px 16px',
                marginBottom: 20,
              }}>
                <Text style={{ color: '#1E40AF', fontSize: 13 }}>
                  Enter your assigned <strong>Student ID</strong> and <strong>Email</strong> to set your personal password.
                </Text>
              </div>

              <Form.Item
                name="student_code"
                rules={[{ required: true, message: 'Please enter your Student ID / Roll No' }]}
              >
                <Input
                  prefix={<IdcardOutlined style={{ color: '#6B6B6B' }} />}
                  placeholder="Student ID / Roll No (e.g. STU001)"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    color: '#111111',
                    height: 44,
                  }}
                />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please enter your registered email' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#6B6B6B' }} />}
                  placeholder="Registered University Email"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    color: '#111111',
                    height: 44,
                  }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: 'Please create a password' },
                  { min: 6, message: 'Password must be at least 6 characters' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#6B6B6B' }} />}
                  placeholder="Create Password (min. 6 chars)"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    color: '#111111',
                    height: 44,
                  }}
                />
              </Form.Item>

              <Form.Item
                name="confirm_password"
                rules={[{ required: true, message: 'Please confirm your password' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#6B6B6B' }} />}
                  placeholder="Confirm Password"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E4E4',
                    borderRadius: 0,
                    color: '#111111',
                    height: 44,
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{
                    height: 44,
                    borderRadius: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    background: '#2563EB',
                    borderColor: '#2563EB',
                  }}
                >
                  {loading ? 'Activating…' : 'Activate & Sign In'}
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: '#6B6B6B', fontSize: 13 }}>
                  Already activated?{' '}
                  <a
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                    }}
                    style={{ color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Sign in here
                  </a>
                </Text>
              </div>
            </Form>
          )}
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

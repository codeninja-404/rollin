'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Button, Typography, Tag, Badge, Space,
  Modal, message, Spin, Empty, Tooltip, Radio, InputNumber,
} from 'antd';
import {
  BookOutlined, PlayCircleOutlined, ClockCircleOutlined,
  EyeOutlined, TeamOutlined, FundProjectionScreenOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { Class, AttendanceSession } from '@/lib/types';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';

const { Title, Text } = Typography;

export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [openSessions, setOpenSessions] = useState<Record<string, AttendanceSession>>({});
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  // Dynamic OTP Period selection modal
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [sessionPeriod, setSessionPeriod] = useState<number>(5);
  const [customPeriod, setCustomPeriod] = useState<number | null>(null);

  // Global settings modal
  const [defaultPeriod, setDefaultPeriod] = useState<number>(5);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, sessionRes, settingsRes] = await Promise.all([
        fetch('/api/admin/classes'),
        fetch('/api/admin/sessions?status=open'),
        fetch('/api/admin/settings'),
      ]);
      const classData = await classRes.json();
      const sessionData = await sessionRes.json();
      const settingsData = await settingsRes.json();

      setClasses(classData.classes ?? []);

      const defP = Number(settingsData.settings?.default_otp_period) || 5;
      setDefaultPeriod(defP);
      setSessionPeriod(defP);

      const map: Record<string, AttendanceSession> = {};
      (sessionData.sessions ?? []).forEach((s: AttendanceSession) => {
        map[s.class_id] = s;
      });
      setOpenSessions(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStartSession = async () => {
    if (!selectedClass) return;

    const chosenPeriod = customPeriod || sessionPeriod;
    setOpening(selectedClass.id);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: selectedClass.id,
          otp_period: chosenPeriod,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        message.success(`Attendance session opened (rotating every ${chosenPeriod}s)!`);
        setSelectedClass(null);
        router.push(`/admin/attendance/sessions/${data.session.id}`);
      } else {
        message.error(data.error ?? 'Failed to open attendance');
      }
    } finally {
      setOpening(null);
    }
  };

  const handleSaveDefaultSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_otp_period: defaultPeriod }),
      });
      if (res.ok) {
        message.success(`Default rolling interval updated to ${defaultPeriod}s`);
        setSettingsModalOpen(false);
        setSessionPeriod(defaultPeriod);
      } else {
        message.error('Failed to save settings');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <AntdConfigProvider>
        <StylishLoader
          message="Loading attendance sessions..."
          submessage="Fetching active courses and rotation status"
        />
      </AntdConfigProvider>
    );
  }

  const activeClasses = classes.filter((c) => c.status === 'active');

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
              Open Attendance
            </Title>
            <Text type="secondary">
              Select a class to start a rotating OTP attendance session
            </Text>
          </div>

          <Button
            icon={<SettingOutlined />}
            onClick={() => setSettingsModalOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: 10,
              height: 38,
              fontWeight: 500,
            }}
          >
            OTP Settings (Default: {defaultPeriod}s)
          </Button>
        </div>

        {/* Open sessions banner */}
        {Object.keys(openSessions).length > 0 && (
          <Card
            style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 14,
              marginBottom: 24,
            }}
            styles={{ body: { padding: '14px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge status="processing" color="#10b981" />
              <Text style={{ color: '#34d399', fontWeight: 600 }}>
                {Object.keys(openSessions).length} session(s) currently open
              </Text>
            </div>
          </Card>
        )}

        {activeClasses.length === 0 ? (
          <Empty description="No active classes. Create a class first." />
        ) : (
          <Row gutter={[20, 20]}>
            {activeClasses.map((cls) => {
              const session = openSessions[cls.id];
              const isOpen = !!session;
              const sessionPeriodSeconds = session?.otp_period || 5;

              return (
                <Col xs={24} sm={12} lg={8} key={cls.id}>
                  <Card
                    style={{
                      background: isOpen
                        ? 'rgba(16,185,129,0.08)'
                        : 'rgba(255,255,255,0.04)',
                      border: isOpen
                        ? '1px solid rgba(16,185,129,0.3)'
                        : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16,
                      height: '100%',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                    styles={{ body: { padding: 24 } }}
                  >
                    {/* Top Right Corner — Share Screen in New Tab */}
                    {isOpen && (
                      <Tooltip title="Share Screen for Students (Opens in New Tab without sidebar)">
                        <Button
                          type="primary"
                          size="small"
                          icon={<FundProjectionScreenOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/present/${session.id}`, '_blank');
                          }}
                          style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: 'none',
                            borderRadius: 8,
                            fontWeight: 600,
                            fontSize: 12,
                            height: 32,
                            padding: '0 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                            zIndex: 2,
                          }}
                        >
                          Share Screen
                        </Button>
                      </Tooltip>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, paddingRight: isOpen ? 100 : 0 }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isOpen ? '#34d399' : '#818cf8',
                        fontSize: 20,
                        flexShrink: 0,
                      }}>
                        <BookOutlined />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, wordBreak: 'break-word' }}>{cls.name}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{cls.course_code}</Text>
                        {[cls.department, cls.semester && `Sem ${cls.semester}`, cls.section && `Sec ${cls.section}`]
                          .filter(Boolean).length > 0 && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {[cls.department, cls.semester && `Sem ${cls.semester}`, cls.section && `Sec ${cls.section}`]
                                .filter(Boolean).join(' · ')}
                            </Text>
                          </div>
                        )}
                      </div>
                    </div>

                    {isOpen ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                          <Badge status="processing" color="#10b981" />
                          <Text style={{ color: '#34d399', fontWeight: 600 }}>
                            Attendance Open
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            · {dayjs(session.started_at).format('h:mm A')}
                          </Text>
                          <Tag color="cyan" style={{ borderRadius: 6, fontSize: 11, marginLeft: 'auto' }}>
                            {sessionPeriodSeconds}s rotation
                          </Tag>
                        </div>
                        <Button
                          type="primary"
                          icon={<EyeOutlined />}
                          block
                          onClick={() => router.push(`/admin/attendance/sessions/${session.id}`)}
                          style={{
                            background: 'linear-gradient(135deg,#10b981,#059669)',
                            border: 'none',
                            borderRadius: 10,
                            height: 40,
                            fontWeight: 600,
                          }}
                        >
                          View Live Session
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        block
                        onClick={() => {
                          setSelectedClass(cls);
                          setSessionPeriod(defaultPeriod);
                          setCustomPeriod(null);
                        }}
                        style={{
                          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                          border: 'none',
                          borderRadius: 10,
                          height: 40,
                          fontWeight: 600,
                        }}
                      >
                        Open Attendance
                      </Button>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {/* Modal: Open Attendance with Configurable OTP Rolling Interval */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PlayCircleOutlined style={{ color: '#6366f1', fontSize: 20 }} />
              <span style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>
                Open Attendance — {selectedClass?.name}
              </span>
            </div>
          }
          open={!!selectedClass}
          onCancel={() => setSelectedClass(null)}
          onOk={handleStartSession}
          okText="Start Attendance Session"
          confirmLoading={opening !== null}
          width={520}
          styles={{ body: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
          okButtonProps={{
            style: {
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none',
              borderRadius: 8,
              height: 38,
              fontWeight: 600,
            },
          }}
        >
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                Course Code: <strong style={{ color: '#818cf8' }}>{selectedClass?.course_code}</strong>
              </Text>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 18,
              marginBottom: 16,
            }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                ⚡ OTP Rolling Interval (Rotation Speed)
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 14 }}>
                The one-time code will dynamically change every interval. Shorter intervals offer maximum anti-proxy security.
              </Text>

              <Radio.Group
                value={customPeriod ? 'custom' : sessionPeriod}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setCustomPeriod(sessionPeriod || 5);
                  } else {
                    setCustomPeriod(null);
                    setSessionPeriod(Number(e.target.value));
                  }
                }}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  <Radio value={5} style={{ color: '#fff' }}>
                    <strong>5 Seconds</strong> <Tag color="red" style={{ marginLeft: 8 }}>Ultra-Fast / Anti-Sharing</Tag>
                  </Radio>
                  <Radio value={10} style={{ color: '#fff' }}>
                    <strong>10 Seconds</strong> <Tag color="blue" style={{ marginLeft: 8 }}>Standard Classroom (Recommended)</Tag>
                  </Radio>
                  <Radio value={15} style={{ color: '#fff' }}>
                    <strong>15 Seconds</strong> <Tag color="default" style={{ marginLeft: 8 }}>Relaxed</Tag>
                  </Radio>
                  <Radio value={30} style={{ color: '#fff' }}>
                    <strong>30 Seconds</strong> <Tag color="default" style={{ marginLeft: 8 }}>Extended</Tag>
                  </Radio>
                  <Radio value="custom" style={{ color: '#fff' }}>
                    <strong>Custom seconds:</strong>{' '}
                    {customPeriod !== null && (
                      <InputNumber
                        min={3}
                        max={120}
                        size="small"
                        value={customPeriod}
                        onChange={(val) => setCustomPeriod(val || 5)}
                        style={{ width: 80, marginLeft: 8 }}
                      />
                    )}
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            <div style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10,
              padding: '10px 14px',
            }}>
              <Text style={{ color: '#a5b4fc', fontSize: 12 }}>
                ℹ️ You can also change the rotation speed live anytime while the session is open.
              </Text>
            </div>
          </div>
        </Modal>

        {/* Modal: Global Default OTP Settings */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SettingOutlined style={{ color: '#6366f1', fontSize: 20 }} />
              <span style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>
                Default OTP Rolling Interval
              </span>
            </div>
          }
          open={settingsModalOpen}
          onCancel={() => setSettingsModalOpen(false)}
          onOk={handleSaveDefaultSettings}
          okText="Save Default Interval"
          confirmLoading={savingSettings}
          width={450}
          styles={{ body: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
          okButtonProps={{
            style: {
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none',
              borderRadius: 8,
              height: 38,
              fontWeight: 600,
            },
          }}
        >
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
              Set the default rotation interval used whenever a new attendance session is started across the school.
            </Text>

            <Radio.Group
              value={defaultPeriod}
              onChange={(e) => setDefaultPeriod(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <Radio value={5} style={{ color: '#fff' }}>5 Seconds (Ultra-Fast)</Radio>
                <Radio value={10} style={{ color: '#fff' }}>10 Seconds (Standard Classroom)</Radio>
                <Radio value={15} style={{ color: '#fff' }}>15 Seconds (Relaxed)</Radio>
                <Radio value={30} style={{ color: '#fff' }}>30 Seconds (Extended)</Radio>
                <Radio value={60} style={{ color: '#fff' }}>60 Seconds (1 minute)</Radio>
              </Space>
            </Radio.Group>
          </div>
        </Modal>
      </div>
    </AntdConfigProvider>
  );
}

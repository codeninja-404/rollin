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
            <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>
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
              background: '#FFFFFF',
              borderColor: '#E4E4E4',
              color: '#111111',
              borderRadius: 0,
              height: 36,
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
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 0,
              marginBottom: 24,
            }}
            styles={{ body: { padding: '14px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge status="processing" color="#16A34A" />
              <Text style={{ color: '#16A34A', fontWeight: 600 }}>
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
                      background: '#FFFFFF',
                      border: isOpen
                        ? '1px solid #16A34A'
                        : '1px solid #E4E4E4',
                      borderRadius: 0,
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
                            background: '#2563EB',
                            borderColor: '#2563EB',
                            borderRadius: 0,
                            fontWeight: 600,
                            fontSize: 12,
                            height: 30,
                            padding: '0 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            zIndex: 2,
                          }}
                        >
                          Share Screen
                        </Button>
                      </Tooltip>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, paddingRight: isOpen ? 100 : 0 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 0,
                        background: isOpen ? '#F0FDF4' : '#EFF6FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isOpen ? '#16A34A' : '#2563EB',
                        fontSize: 18,
                        flexShrink: 0,
                      }}>
                        <BookOutlined />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#111111', fontWeight: 700, fontSize: 15, wordBreak: 'break-word' }}>{cls.name}</div>
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
                          <Badge status="processing" color="#16A34A" />
                          <Text style={{ color: '#16A34A', fontWeight: 600 }}>
                            Attendance Open
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            · {dayjs(session.started_at).format('h:mm A')}
                          </Text>
                          <Tag color="cyan" style={{ borderRadius: 0, fontSize: 11, marginLeft: 'auto' }}>
                            {sessionPeriodSeconds}s rotation
                          </Tag>
                        </div>
                        <Button
                          type="primary"
                          icon={<EyeOutlined />}
                          block
                          onClick={() => router.push(`/admin/attendance/sessions/${session.id}`)}
                          style={{
                            background: '#16A34A',
                            borderColor: '#16A34A',
                            borderRadius: 0,
                            height: 38,
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
                          background: '#2563EB',
                          borderColor: '#2563EB',
                          borderRadius: 0,
                          height: 38,
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
              <PlayCircleOutlined style={{ color: '#2563EB', fontSize: 20 }} />
              <span style={{ color: '#111111', fontSize: 17, fontWeight: 700 }}>
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
          styles={{ body: { background: '#FFFFFF' }, header: { background: '#FFFFFF' } }}
          okButtonProps={{
            style: {
              background: '#2563EB',
              borderColor: '#2563EB',
              borderRadius: 0,
              height: 36,
              fontWeight: 600,
            },
          }}
          cancelButtonProps={{
            style: {
              borderRadius: 0,
            },
          }}
        >
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: '#6B6B6B', fontSize: 14 }}>
                Course Code: <strong style={{ color: '#2563EB' }}>{selectedClass?.course_code}</strong>
              </Text>
            </div>

            <div style={{
              background: '#FAFAFA',
              border: '1px solid #E4E4E4',
              borderRadius: 0,
              padding: 18,
              marginBottom: 16,
            }}>
              <div style={{ color: '#111111', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                OTP Rolling Interval (Rotation Speed)
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
                <Space orientation="vertical" style={{ width: '100%' }} size={10}>
                  <Radio value={5} style={{ color: '#111111' }}>
                    <strong>5 Seconds</strong> <Tag color="red" style={{ marginLeft: 8, borderRadius: 0 }}>Ultra-Fast / Anti-Sharing</Tag>
                  </Radio>
                  <Radio value={10} style={{ color: '#111111' }}>
                    <strong>10 Seconds</strong> <Tag color="blue" style={{ marginLeft: 8, borderRadius: 0 }}>Standard Classroom (Recommended)</Tag>
                  </Radio>
                  <Radio value={15} style={{ color: '#111111' }}>
                    <strong>15 Seconds</strong> <Tag color="default" style={{ marginLeft: 8, borderRadius: 0 }}>Relaxed</Tag>
                  </Radio>
                  <Radio value={30} style={{ color: '#111111' }}>
                    <strong>30 Seconds</strong> <Tag color="default" style={{ marginLeft: 8, borderRadius: 0 }}>Extended</Tag>
                  </Radio>
                  <Radio value="custom" style={{ color: '#111111' }}>
                    <strong>Custom seconds:</strong>{' '}
                    {customPeriod !== null && (
                      <InputNumber
                        min={3}
                        max={120}
                        size="small"
                        value={customPeriod}
                        onChange={(val) => setCustomPeriod(val || 5)}
                        style={{ width: 80, marginLeft: 8, borderRadius: 0 }}
                      />
                    )}
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 0,
              padding: '10px 14px',
            }}>
              <Text style={{ color: '#1E40AF', fontSize: 12 }}>
                You can also change the rotation speed live anytime while the session is open.
              </Text>
            </div>
          </div>
        </Modal>

        {/* Modal: Global Default OTP Settings */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SettingOutlined style={{ color: '#2563EB', fontSize: 20 }} />
              <span style={{ color: '#111111', fontSize: 17, fontWeight: 700 }}>
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
          styles={{ body: { background: '#FFFFFF' }, header: { background: '#FFFFFF' } }}
          okButtonProps={{
            style: {
              background: '#2563EB',
              borderColor: '#2563EB',
              borderRadius: 0,
              height: 36,
              fontWeight: 600,
            },
          }}
          cancelButtonProps={{
            style: {
              borderRadius: 0,
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
              <Space orientation="vertical" style={{ width: '100%' }} size={10}>
                <Radio value={5} style={{ color: '#111111' }}>5 Seconds (Ultra-Fast)</Radio>
                <Radio value={10} style={{ color: '#111111' }}>10 Seconds (Standard Classroom)</Radio>
                <Radio value={15} style={{ color: '#111111' }}>15 Seconds (Relaxed)</Radio>
                <Radio value={30} style={{ color: '#111111' }}>30 Seconds (Extended)</Radio>
                <Radio value={60} style={{ color: '#111111' }}>60 Seconds (1 minute)</Radio>
              </Space>
            </Radio.Group>
          </div>
        </Modal>
      </div>
    </AntdConfigProvider>
  );
}

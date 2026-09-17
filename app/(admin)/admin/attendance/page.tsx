'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card, Button, Typography, Tag, Badge, Space,
  Modal, Tooltip, Radio, InputNumber, Input,
  Popconfirm, Alert, Row, Col, App,
} from 'antd';
import {
  BookOutlined, PlayCircleOutlined, ClockCircleOutlined,
  EyeOutlined, FundProjectionScreenOutlined, SettingOutlined,
  CloseCircleOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Class, AttendanceSession } from '@/lib/types';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';
import SharedTable from '@/components/SharedTable';

const { Title, Text } = Typography;

export default function AttendancePage() {
  const { message } = App.useApp();
  const [classes, setClasses] = useState<Class[]>([]);
  const [openSessions, setOpenSessions] = useState<Record<string, AttendanceSession>>({});
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  // Search filter
  const [search, setSearch] = useState('');

  // Row selection for multi-class attendance
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Single start session modal
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [sessionPeriod, setSessionPeriod] = useState<number>(5);
  const [customPeriod, setCustomPeriod] = useState<number | null>(null);

  // Batch start session modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchOpening, setBatchOpening] = useState(false);
  const [batchPeriod, setBatchPeriod] = useState<number>(5);
  const [batchCustomPeriod, setBatchCustomPeriod] = useState<number | null>(null);

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
      setBatchPeriod(defP);

      const map: Record<string, AttendanceSession> = {};
      (sessionData.sessions ?? []).forEach((s: AttendanceSession) => {
        map[s.class_id] = s;
      });
      setOpenSessions(map);
    } catch {
      message.error('Failed to load classes or active sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Single Class Start
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
        message.success(`Attendance session opened for ${selectedClass.name} (rotating every ${chosenPeriod}s)!`);
        setSelectedClass(null);
        router.push(`/admin/attendance/sessions/${data.session.id}`);
      } else {
        message.error(data.error ?? 'Failed to open attendance');
      }
    } catch {
      message.error('Error opening attendance session');
    } finally {
      setOpening(null);
    }
  };

  // Single Class Close
  const handleCloseSession = async (sessionId: string, className?: string) => {
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      if (res.ok) {
        message.success(className ? `Attendance closed for ${className}` : 'Attendance session closed');
        load();
      } else {
        message.error('Failed to close session');
      }
    } catch {
      message.error('Error closing session');
    }
  };

  // Close All Active Sessions
  const handleCloseAllSessions = async () => {
    const activeSessionList = Object.values(openSessions);
    if (activeSessionList.length === 0) return;

    let closed = 0;
    await Promise.allSettled(
      activeSessionList.map(async (s) => {
        const res = await fetch(`/api/admin/sessions/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        });
        if (res.ok) closed++;
      })
    );

    message.success(`Closed ${closed} active attendance session(s)`);
    load();
  };

  // Save Global Default Settings
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
        setBatchPeriod(defaultPeriod);
      } else {
        message.error('Failed to save settings');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  // Multi-Class Batch Start
  const activeClasses = useMemo(() => classes.filter((c) => c.status === 'active'), [classes]);

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return activeClasses;
    const q = search.toLowerCase().trim();
    return activeClasses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.course_code.toLowerCase().includes(q) ||
        (c.department && c.department.toLowerCase().includes(q))
    );
  }, [activeClasses, search]);

  const selectedClasses = useMemo(
    () => activeClasses.filter((c) => selectedRowKeys.includes(c.id)),
    [activeClasses, selectedRowKeys]
  );

  const selectedIdleClasses = useMemo(
    () => selectedClasses.filter((c) => !openSessions[c.id]),
    [selectedClasses, openSessions]
  );

  const selectedLiveClasses = useMemo(
    () => selectedClasses.filter((c) => !!openSessions[c.id]),
    [selectedClasses, openSessions]
  );

  const handleBatchStartSessions = async () => {
    if (selectedIdleClasses.length === 0) return;
    setBatchOpening(true);
    const chosenPeriod = batchCustomPeriod || batchPeriod;
    let successCount = 0;

    await Promise.allSettled(
      selectedIdleClasses.map(async (cls) => {
        const res = await fetch('/api/admin/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ class_id: cls.id, otp_period: chosenPeriod }),
        });
        if (res.ok) successCount++;
      })
    );

    setBatchOpening(false);
    setBatchModalOpen(false);
    setSelectedRowKeys([]);
    message.success(`Successfully opened attendance for ${successCount} classes!`);
    load();
  };

  const handleBatchCloseSessions = async () => {
    if (selectedLiveClasses.length === 0) return;
    let closedCount = 0;
    await Promise.allSettled(
      selectedLiveClasses.map(async (cls) => {
        const session = openSessions[cls.id];
        if (session) {
          const res = await fetch(`/api/admin/sessions/${session.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'closed' }),
          });
          if (res.ok) closedCount++;
        }
      })
    );
    setSelectedRowKeys([]);
    message.success(`Closed attendance for ${closedCount} class session(s)`);
    load();
  };

  const openSessionCount = Object.keys(openSessions).length;

  const columns: ColumnsType<Class> = [
    {
      title: 'Class / Course',
      key: 'class',
      width: 280,
      render: (_, cls) => {
        const session = openSessions[cls.id];
        const isOpen = !!session;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: isOpen ? '#F0FDF4' : '#EFF6FF',
                border: isOpen ? '1px solid #BBF7D0' : '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isOpen ? '#16A34A' : '#2563EB',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              <BookOutlined />
            </div>
            <div>
              <div style={{ color: '#111111', fontWeight: 600, fontSize: 13.5 }}>{cls.name}</div>
              <Tag
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  background: '#F4F4F5',
                  borderColor: '#E4E4E4',
                  color: '#2563EB',
                  fontWeight: 600,
                  borderRadius: 0,
                }}
              >
                {cls.course_code}
              </Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Academic Info',
      key: 'academic',
      width: 220,
      render: (_, cls) => (
        <span style={{ color: '#6B6B6B', fontSize: 12.5 }}>
          {[cls.department, cls.semester && `Sem ${cls.semester}`, cls.section && `Sec ${cls.section}`]
            .filter(Boolean)
            .join(' · ') || '—'}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 240,
      render: (_, cls) => {
        const session = openSessions[cls.id];
        if (session) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge status="processing" color="#16A34A" />
              <span style={{ color: '#16A34A', fontWeight: 600, fontSize: 12.5 }}>
                Live Attendance
              </span>
              <span style={{ color: '#6B6B6B', fontSize: 11.5 }}>
                · {dayjs(session.started_at).format('h:mm A')}
              </span>
              <Tag color="cyan" style={{ borderRadius: 0, fontSize: 10.5, margin: 0, fontWeight: 600 }}>
                {session.otp_period || 5}s rotation
              </Tag>
            </div>
          );
        }
        return (
          <Tag color="default" style={{ borderRadius: 0, fontSize: 11, color: '#6B6B6B' }}>
            IDLE / CLOSED
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      fixed: 'right' as const,
      render: (_, cls) => {
        const session = openSessions[cls.id];
        if (session) {
          return (
            <Space size={6} wrap>
              <Button
                type="primary"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => router.push(`/admin/attendance/sessions/${session.id}`)}
                style={{
                  background: '#16A34A',
                  borderColor: '#16A34A',
                  borderRadius: 0,
                  fontSize: 12,
                  height: 30,
                  fontWeight: 600,
                }}
              >
                View Live
              </Button>

              <Tooltip title="Share Screen in New Tab without sidebar">
                <Button
                  size="small"
                  icon={<FundProjectionScreenOutlined />}
                  onClick={() => window.open(`/present/${session.id}`, '_blank')}
                  style={{
                    borderRadius: 0,
                    fontSize: 12,
                    height: 30,
                    fontWeight: 500,
                    borderColor: '#BFDBFE',
                    color: '#2563EB',
                  }}
                >
                  Share Screen
                </Button>
              </Tooltip>

              <Popconfirm
                title="Close Attendance Session"
                description={`End attendance check-in for ${cls.name}?`}
                onConfirm={() => handleCloseSession(session.id, cls.name)}
                okText="Close Session"
                okType="danger"
                cancelText="Cancel"
                okButtonProps={{ style: { borderRadius: 0 } }}
                cancelButtonProps={{ style: { borderRadius: 0 } }}
              >
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  style={{
                    borderRadius: 0,
                    fontSize: 12,
                    height: 30,
                  }}
                >
                  Close
                </Button>
              </Popconfirm>
            </Space>
          );
        }

        return (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => {
              setSelectedClass(cls);
              setSessionPeriod(defaultPeriod);
              setCustomPeriod(null);
            }}
            style={{
              background: '#2563EB',
              borderColor: '#2563EB',
              borderRadius: 0,
              fontSize: 12,
              height: 30,
              fontWeight: 600,
            }}
          >
            Open Attendance
          </Button>
        );
      },
    },
  ];

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

  return (
    <AntdConfigProvider>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>
              Open Attendance
            </Title>
            <Text type="secondary" style={{ color: '#6B6B6B' }}>
              Select classes to start rotating OTP attendance sessions. You can open multiple sessions concurrently class-wise.
            </Text>
          </div>

          <Space size={10} wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={load}
              style={{
                background: '#FFFFFF',
                borderColor: '#E4E4E4',
                color: '#111111',
                borderRadius: 0,
                height: 36,
              }}
            >
              Refresh
            </Button>
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
          </Space>
        </div>

        {/* Live Sessions Overview Banner */}
        {openSessionCount > 0 && (
          <Card
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 0,
              marginBottom: 16,
            }}
            styles={{ body: { padding: '12px 18px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge status="processing" color="#16A34A" />
                <Text style={{ color: '#16A34A', fontWeight: 700, fontSize: 13.5 }}>
                  {openSessionCount} class attendance session(s) currently open and rotating
                </Text>
              </div>
              <Popconfirm
                title="Close All Live Sessions"
                description={`Are you sure you want to end all ${openSessionCount} active attendance sessions across the school?`}
                onConfirm={handleCloseAllSessions}
                okText="Close All"
                okType="danger"
                cancelText="Cancel"
                okButtonProps={{ style: { borderRadius: 0 } }}
                cancelButtonProps={{ style: { borderRadius: 0 } }}
              >
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  style={{ borderRadius: 0, fontWeight: 500 }}
                >
                  Close All Active Sessions
                </Button>
              </Popconfirm>
            </div>
          </Card>
        )}

        {/* Filters and Batch Actions Toolbar */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            marginBottom: 16,
          }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <Row gutter={[12, 12]} align="middle" justify="space-between">
            <Col xs={24} sm={12} md={8}>
              <Input
                prefix={<SearchOutlined style={{ color: '#6B6B6B' }} />}
                placeholder="Search classes by name, code, or department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{
                  height: 36,
                  background: '#FFFFFF',
                  borderColor: '#E4E4E4',
                  borderRadius: 0,
                  color: '#111111',
                }}
              />
            </Col>

            <Col xs={24} sm={12} md={16} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {selectedRowKeys.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 13, color: '#2563EB', fontWeight: 600 }}>
                    {selectedRowKeys.length} class(es) selected
                  </Text>

                  {selectedIdleClasses.length > 0 && (
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => {
                        setBatchPeriod(defaultPeriod);
                        setBatchCustomPeriod(null);
                        setBatchModalOpen(true);
                      }}
                      style={{
                        background: '#2563EB',
                        borderColor: '#2563EB',
                        borderRadius: 0,
                        height: 34,
                        fontWeight: 600,
                      }}
                    >
                      Open Attendance ({selectedIdleClasses.length})
                    </Button>
                  )}

                  {selectedLiveClasses.length > 0 && (
                    <Popconfirm
                      title="Close Selected Live Sessions"
                      description={`Close attendance for ${selectedLiveClasses.length} selected class(es)?`}
                      onConfirm={handleBatchCloseSessions}
                      okText="Close Sessions"
                      okType="danger"
                      cancelText="Cancel"
                      okButtonProps={{ style: { borderRadius: 0 } }}
                      cancelButtonProps={{ style: { borderRadius: 0 } }}
                    >
                      <Button
                        danger
                        icon={<CloseCircleOutlined />}
                        style={{
                          borderRadius: 0,
                          height: 34,
                          fontWeight: 500,
                        }}
                      >
                        Close Selected ({selectedLiveClasses.length})
                      </Button>
                    </Popconfirm>
                  )}

                  <Button
                    onClick={() => setSelectedRowKeys([])}
                    style={{
                      borderRadius: 0,
                      height: 34,
                      color: '#6B6B6B',
                    }}
                  >
                    Deselect All
                  </Button>
                </div>
              )}
            </Col>
          </Row>
        </Card>

        {/* Classes Table */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            overflow: 'hidden',
          }}
          styles={{ body: { padding: 0 } }}
        >
          <SharedTable
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            dataSource={filteredClasses}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 12, showSizeChanger: true, pageSizeOptions: ['12', '24', '48'] }}
            scroll={{ x: 950 }}
            locale={{ emptyText: 'No active classes found.' }}
          />
        </Card>

        {/* Modal: Single Class Open Attendance */}
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
                You can also change rotation speed or share full projector view anytime once opened.
              </Text>
            </div>
          </div>
        </Modal>

        {/* Modal: Batch Open Attendance for Multiple Classes */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AppstoreOutlined style={{ color: '#2563EB', fontSize: 20 }} />
              <span style={{ color: '#111111', fontSize: 17, fontWeight: 700 }}>
                Open Attendance for {selectedIdleClasses.length} Selected Classes
              </span>
            </div>
          }
          open={batchModalOpen}
          onCancel={() => setBatchModalOpen(false)}
          onOk={handleBatchStartSessions}
          okText={`Open ${selectedIdleClasses.length} Sessions`}
          confirmLoading={batchOpening}
          width={540}
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
            <div style={{ marginBottom: 16, maxHeight: 120, overflowY: 'auto', background: '#FAFAFA', border: '1px solid #E4E4E4', padding: '8px 12px' }}>
              <Text strong style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>
                CLASSES TO BE OPENED:
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedIdleClasses.map((cls) => (
                  <Tag key={cls.id} color="blue" style={{ borderRadius: 0, fontSize: 11 }}>
                    {cls.name} ({cls.course_code})
                  </Tag>
                ))}
              </div>
            </div>

            <div style={{
              background: '#FAFAFA',
              border: '1px solid #E4E4E4',
              borderRadius: 0,
              padding: 18,
              marginBottom: 16,
            }}>
              <div style={{ color: '#111111', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                OTP Rolling Interval for All Selected Classes
              </div>

              <Radio.Group
                value={batchCustomPeriod ? 'custom' : batchPeriod}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setBatchCustomPeriod(batchPeriod || 5);
                  } else {
                    setBatchCustomPeriod(null);
                    setBatchPeriod(Number(e.target.value));
                  }
                }}
                style={{ width: '100%' }}
              >
                <Space orientation="vertical" style={{ width: '100%' }} size={10}>
                  <Radio value={5} style={{ color: '#111111' }}>
                    <strong>5 Seconds</strong> <Tag color="red" style={{ marginLeft: 8, borderRadius: 0 }}>Ultra-Fast</Tag>
                  </Radio>
                  <Radio value={10} style={{ color: '#111111' }}>
                    <strong>10 Seconds</strong> <Tag color="blue" style={{ marginLeft: 8, borderRadius: 0 }}>Standard Classroom</Tag>
                  </Radio>
                  <Radio value={15} style={{ color: '#111111' }}>
                    <strong>15 Seconds</strong> <Tag color="default" style={{ marginLeft: 8, borderRadius: 0 }}>Relaxed</Tag>
                  </Radio>
                  <Radio value={30} style={{ color: '#111111' }}>
                    <strong>30 Seconds</strong> <Tag color="default" style={{ marginLeft: 8, borderRadius: 0 }}>Extended</Tag>
                  </Radio>
                  <Radio value="custom" style={{ color: '#111111' }}>
                    <strong>Custom seconds:</strong>{' '}
                    {batchCustomPeriod !== null && (
                      <InputNumber
                        min={3}
                        max={120}
                        size="small"
                        value={batchCustomPeriod}
                        onChange={(val) => setBatchCustomPeriod(val || 5)}
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
                Each class will receive an independent cryptographic OTP seed and distinct projector link.
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

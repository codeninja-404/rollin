'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Typography, Tag, Select, DatePicker, Space,
  Button, Drawer, List, Avatar, Badge,
} from 'antd';
import { HistoryOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { AttendanceSession, Attendance } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;
const { Option } = Select;

export default function HistoryPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AttendanceSession | null>(null);
  const [sessionAttendance, setSessionAttendance] = useState<Attendance[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/sessions?status=closed');
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const viewSession = async (session: AttendanceSession) => {
    setSelected(session);
    setDrawerOpen(true);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`);
      const data = await res.json();
      setSessionAttendance(data.attendance ?? []);
    } finally {
      setLoadingDetail(false);
    }
  };

  const columns = [
    {
      title: 'Class',
      key: 'class',
      render: (_: any, s: AttendanceSession) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{(s.class as any)?.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{(s.class as any)?.course_code}</Text>
        </div>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'started_at',
      render: (v: string) => dayjs(v).format('MMM D, YYYY h:mm A'),
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: any, s: AttendanceSession) => {
        if (!s.ended_at) return <Text type="secondary">—</Text>;
        const mins = dayjs(s.ended_at).diff(dayjs(s.started_at), 'minute');
        return <Text type="secondary">{mins} min</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'open' ? 'green' : 'default'} style={{ borderRadius: 6 }}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, s: AttendanceSession) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          style={{ color: '#818cf8' }}
          onClick={() => viewSession(s)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
            Attendance History
          </Title>
          <Text type="secondary">Past sessions and attendance records</Text>
        </div>

        <Card
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            dataSource={sessions}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: 'No closed sessions yet' }}
          />
        </Card>

        {/* Session detail drawer */}
        <Drawer
          title={
            selected ? (
              <div>
                <div style={{ color: '#fff', fontWeight: 700 }}>{(selected.class as any)?.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(selected.started_at).format('MMMM D, YYYY h:mm A')}
                </Text>
              </div>
            ) : null
          }
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={400}
          styles={{ body: { padding: 20 }, header: { background: '#1a1a2e' }, wrapper: { background: '#1a1a2e' } }}
        >
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              {sessionAttendance.length} students attended
            </Text>
          </div>
          <List
            loading={loadingDetail}
            dataSource={sessionAttendance}
            renderItem={(a) => (
              <List.Item style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <Avatar size={32} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {(a.student as any)?.name?.charAt(0)}
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{(a.student as any)?.name}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{(a.student as any)?.student_code}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(a.marked_at).format('h:mm:ss A')}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        </Drawer>
      </div>
    </AntdConfigProvider>
  );
}

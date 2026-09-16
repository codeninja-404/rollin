'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Tag, Button, Statistic, Row, Col, Spin, Empty, Descriptions, Table,
} from 'antd';
import { ArrowLeftOutlined, TeamOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { Class, AttendanceSession } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';

const { Title, Text } = Typography;

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [cls, setCls] = useState<Class | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { id } = await params;
      setClassId(id);
      try {
        const res = await fetch(`/api/admin/classes/${id}`);
        const data = await res.json();
        setCls(data.class);
        setSessions(data.sessions ?? []);
        setStudentCount(data.studentCount ?? 0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params]);

  if (loading) {
    return (
      <AntdConfigProvider>
        <StylishLoader
          message="Loading course details..."
          submessage="Retrieving enrolled students and session analytics"
        />
      </AntdConfigProvider>
    );
  }
  if (!cls) return <Empty description="Class not found" />;

  const sessionColumns = [
    {
      title: 'Date',
      dataIndex: 'started_at',
      render: (v: string) => dayjs(v).format('MMM D, YYYY h:mm A'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => (
        <Tag color={s === 'open' ? 'green' : 'default'} style={{ borderRadius: 6 }}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: any, s: AttendanceSession) => {
        if (!s.ended_at) return <Text type="secondary">Ongoing</Text>;
        const mins = dayjs(s.ended_at).diff(dayjs(s.started_at), 'minute');
        return <Text type="secondary">{mins} min</Text>;
      },
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, s: AttendanceSession) => (
        s.status === 'open' ? (
          <Button
            size="small"
            type="primary"
            onClick={() => router.push(`/admin/attendance/sessions/${s.id}`)}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 6 }}
          >
            View Live
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/admin/classes')}
          style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}
        >
          Back to Classes
        </Button>

        {/* Class header */}
        <Card
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            marginBottom: 20,
          }}
          styles={{ body: { padding: 28 } }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Title level={2} style={{ color: '#fff', margin: 0 }}>{cls.name}</Title>
                <Tag color="blue" style={{ borderRadius: 6 }}>{cls.course_code}</Tag>
                <Tag color={cls.status === 'active' ? 'green' : 'default'} style={{ borderRadius: 6 }}>
                  {cls.status.toUpperCase()}
                </Tag>
              </div>
              <Descriptions column={3} labelStyle={{ color: 'rgba(255,255,255,0.5)' }} contentStyle={{ color: '#fff' }}>
                <Descriptions.Item label="Department">{cls.department ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Semester">{cls.semester ? `Semester ${cls.semester}` : '—'}</Descriptions.Item>
                <Descriptions.Item label="Section">{cls.section ?? '—'}</Descriptions.Item>
              </Descriptions>
            </div>
            <Button
              type="primary"
              icon={<TeamOutlined />}
              onClick={() => router.push(`/admin/classes/${classId}/students`)}
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, height: 40 }}
            >
              Manage Students
            </Button>
          </div>

          <Row gutter={24} style={{ marginTop: 24 }}>
            <Col>
              <div style={{ textAlign: 'center', padding: '12px 24px', background: 'rgba(99,102,241,0.1)', borderRadius: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#818cf8' }}>{studentCount}</div>
                <Text type="secondary">Students Enrolled</Text>
              </div>
            </Col>
            <Col>
              <div style={{ textAlign: 'center', padding: '12px 24px', background: 'rgba(16,185,129,0.1)', borderRadius: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#34d399' }}>{sessions.length}</div>
                <Text type="secondary">Sessions Total</Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Sessions */}
        <Card
          title={<Text strong style={{ color: '#fff' }}>Attendance Sessions</Text>}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
          styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' }, body: { padding: 0 } }}
        >
          <Table
            dataSource={sessions}
            columns={sessionColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false, style: { padding: '8px 16px', margin: 0 } }}
            locale={{ emptyText: 'No sessions yet' }}
          />
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

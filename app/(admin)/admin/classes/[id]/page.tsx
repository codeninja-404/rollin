'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Tag, Button, Row, Col, Empty, Descriptions,
} from 'antd';
import { ArrowLeftOutlined, TeamOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { Class, AttendanceSession } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';
import SharedTable from '@/components/SharedTable';

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
      width: 200,
      render: (v: string) => <span style={{ color: '#111111' }}>{dayjs(v).format('MMM D, YYYY h:mm A')}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (s: string) => (
        <Tag color={s === 'open' ? 'success' : 'default'} style={{ borderRadius: 0, fontWeight: 600 }}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 120,
      render: (_: any, s: AttendanceSession) => {
        if (!s.ended_at) return <Text type="secondary" style={{ color: '#6B6B6B' }}>Ongoing</Text>;
        const mins = dayjs(s.ended_at).diff(dayjs(s.started_at), 'minute');
        return <Text type="secondary" style={{ color: '#6B6B6B' }}>{mins} min</Text>;
      },
    },
    {
      title: 'Action',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, s: AttendanceSession) => (
        s.status === 'open' ? (
          <Button
            size="small"
            type="primary"
            onClick={() => router.push(`/admin/attendance/sessions/${s.id}`)}
            style={{ background: '#2563EB', borderColor: '#2563EB', borderRadius: 0, fontWeight: 500 }}
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
          style={{ color: '#6B6B6B', marginBottom: 16, padding: 0 }}
        >
          Back to Classes
        </Button>

        {/* Class header */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            marginBottom: 20,
          }}
          styles={{ body: { padding: 24 } }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>{cls.name}</Title>
                <Tag color="blue" style={{ borderRadius: 0, fontWeight: 600 }}>{cls.course_code}</Tag>
                <Tag color={cls.status === 'active' ? 'success' : 'default'} style={{ borderRadius: 0, fontWeight: 600 }}>
                  {cls.status.toUpperCase()}
                </Tag>
              </div>
              <Descriptions
                column={{ xs: 1, sm: 2, md: 3 }}
                styles={{ label: { color: '#6B6B6B' }, content: { color: '#111111', fontWeight: 500 } }}
              >
                <Descriptions.Item label="Department">{cls.department ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Semester">{cls.semester ? `Semester ${cls.semester}` : '—'}</Descriptions.Item>
                <Descriptions.Item label="Section">{cls.section ?? '—'}</Descriptions.Item>
              </Descriptions>
            </div>
            <Button
              type="primary"
              icon={<TeamOutlined />}
              onClick={() => router.push(`/admin/classes/${classId}/students`)}
              style={{ background: '#2563EB', borderColor: '#2563EB', borderRadius: 0, height: 36, fontWeight: 600 }}
            >
              Manage Students
            </Button>
          </div>

          <Row gutter={16} style={{ marginTop: 20 }}>
            <Col xs={12} sm={6}>
              <div style={{ padding: '12px 16px', background: '#F4F4F5', border: '1px solid #E4E4E4', borderRadius: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#2563EB' }}>{studentCount}</div>
                <Text type="secondary" style={{ fontSize: 12, color: '#6B6B6B' }}>Students Enrolled</Text>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ padding: '12px 16px', background: '#F4F4F5', border: '1px solid #E4E4E4', borderRadius: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#16A34A' }}>{sessions.length}</div>
                <Text type="secondary" style={{ fontSize: 12, color: '#6B6B6B' }}>Sessions Total</Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Sessions */}
        <Card
          title={<Text strong style={{ color: '#111111', fontSize: 14 }}>Attendance Sessions</Text>}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            overflow: 'hidden',
          }}
          styles={{ header: { borderBottom: '1px solid #E4E4E4' }, body: { padding: 0 } }}
        >
          <SharedTable
            dataSource={sessions}
            columns={sessionColumns}
            rowKey="id"
            scroll={{ x: 530 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{ emptyText: 'No sessions yet' }}
          />
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

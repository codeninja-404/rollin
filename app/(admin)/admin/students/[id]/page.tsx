'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Descriptions, Tag, Avatar, Table, Tabs, Typography,
  Button, Spin, Empty, Badge,
} from 'antd';
import { ArrowLeftOutlined, BookOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { Student, ClassStudent, Attendance } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';

const { Title, Text } = Typography;

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassStudent[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { id } = await params;
      try {
        const res = await fetch(`/api/admin/students/${id}`);
        const data = await res.json();
        setStudent(data.student);
        setClasses(data.classes ?? []);
        setAttendance(data.attendance ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!student) return <Empty description="Student not found" />;

  const attendanceColumns = [
    {
      title: 'Class',
      key: 'class',
      render: (_: any, a: Attendance) => (
        <Text style={{ color: '#fff' }}>{(a.session as any)?.class?.name ?? '—'}</Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'marked_at',
      render: (val: string) => dayjs(val).format('MMM D, YYYY h:mm A'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => (
        <Tag color="green" style={{ borderRadius: 6 }}>{s.toUpperCase()}</Tag>
      ),
    },
  ];

  const classColumns = [
    {
      title: 'Class',
      key: 'class',
      render: (_: any, cs: ClassStudent) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{cs.class?.name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{cs.class?.course_code}</Text>
        </div>
      ),
    },
    {
      title: 'Department',
      render: (_: any, cs: ClassStudent) => <Text type="secondary">{cs.class?.department ?? '—'}</Text>,
    },
    {
      title: 'Assigned',
      dataIndex: 'created_at',
      render: (val: string) => dayjs(val).format('MMM D, YYYY'),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/admin/students')}
          style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}
        >
          Back to Students
        </Button>

        {/* Profile card */}
        <Card
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            marginBottom: 20,
          }}
          styles={{ body: { padding: 28 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <Avatar
              size={72}
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', fontSize: 28 }}
            >
              {student.name.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Title level={3} style={{ color: '#fff', margin: 0 }}>{student.name}</Title>
              <Text type="secondary">{student.student_code}</Text>
              <div style={{ marginTop: 6 }}>
                <Tag color={student.status === 'active' ? 'green' : 'default'} style={{ borderRadius: 6 }}>
                  {student.status.toUpperCase()}
                </Tag>
              </div>
            </div>
          </div>

          <Descriptions column={{ xs: 1, sm: 2 }} styles={{ label: { color: 'rgba(255,255,255,0.5)' }, content: { color: '#fff' } }}>
            <Descriptions.Item label="Email">{student.email}</Descriptions.Item>
            <Descriptions.Item label="Department">{student.department ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Semester">{student.semester ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Section">{student.section ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Joined">{dayjs(student.created_at).format('MMMM D, YYYY')}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Tabs */}
        <Card
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Tabs
            defaultActiveKey="classes"
            style={{ padding: '0 16px' }}
            items={[
              {
                key: 'classes',
                label: `Classes (${classes.length})`,
                children: (
                  <Table
                    dataSource={classes}
                    columns={classColumns}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: 'Not assigned to any classes' }}
                    style={{ padding: '0 16px 16px' }}
                  />
                ),
              },
              {
                key: 'attendance',
                label: `Attendance (${attendance.length})`,
                children: (
                  <Table
                    dataSource={attendance}
                    columns={attendanceColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    locale={{ emptyText: 'No attendance records' }}
                    style={{ padding: '0 16px 16px' }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

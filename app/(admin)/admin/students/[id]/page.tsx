'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Descriptions, Tag, Avatar, Tabs, Typography,
  Button, Empty,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { Student, ClassStudent, Attendance } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';
import SharedTable from '@/components/SharedTable';

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

  if (loading) {
    return (
      <AntdConfigProvider>
        <StylishLoader
          message="Loading student profile..."
          submessage="Retrieving enrolled courses and attendance history"
        />
      </AntdConfigProvider>
    );
  }
  if (!student) return <Empty description="Student not found" />;

  const attendanceColumns = [
    {
      title: 'Class',
      key: 'class',
      width: 220,
      render: (_: any, a: Attendance) => (
        <span style={{ color: '#111111', fontWeight: 500 }}>{(a.session as any)?.class?.name ?? '—'}</span>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'marked_at',
      width: 180,
      render: (val: string) => <span style={{ color: '#111111' }}>{dayjs(val).format('MMM D, YYYY h:mm A')}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      align: 'center' as const,
      render: (s: string) => (
        <Tag color="success" style={{ borderRadius: 0, fontWeight: 600 }}>{s.toUpperCase()}</Tag>
      ),
    },
  ];

  const classColumns = [
    {
      title: 'Class',
      key: 'class',
      width: 220,
      render: (_: any, cs: ClassStudent) => (
        <div>
          <div style={{ color: '#111111', fontWeight: 600 }}>{cs.class?.name}</div>
          <Text type="secondary" style={{ fontSize: 12, color: '#6B6B6B' }}>{cs.class?.course_code}</Text>
        </div>
      ),
    },
    {
      title: 'Department',
      width: 150,
      render: (_: any, cs: ClassStudent) => <span style={{ color: '#6B6B6B' }}>{cs.class?.department ?? '—'}</span>,
    },
    {
      title: 'Assigned Date',
      dataIndex: 'created_at',
      width: 140,
      render: (val: string) => <span style={{ color: '#6B6B6B' }}>{dayjs(val).format('MMM D, YYYY')}</span>,
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/admin/students')}
          style={{ color: '#6B6B6B', marginBottom: 16, padding: 0 }}
        >
          Back to Students
        </Button>

        {/* Profile card */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            marginBottom: 20,
          }}
          styles={{ body: { padding: 24 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <Avatar
              size={56}
              style={{ background: '#2563EB', color: '#FFFFFF', fontSize: 22, fontWeight: 700, borderRadius: 0 }}
            >
              {student.name.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Title level={3} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>{student.name}</Title>
              <Text type="secondary" style={{ color: '#6B6B6B' }}>{student.student_code}</Text>
              <div style={{ marginTop: 6 }}>
                <Tag
                  color={student.status === 'active' ? 'success' : 'default'}
                  style={{ borderRadius: 0, fontWeight: 600 }}
                >
                  {student.status.toUpperCase()}
                </Tag>
              </div>
            </div>
          </div>

          <Descriptions
            column={{ xs: 1, sm: 2, md: 3 }}
            styles={{ label: { color: '#6B6B6B' }, content: { color: '#111111', fontWeight: 500 } }}
          >
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
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
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
                  <div style={{ padding: '0 0 16px', overflowX: 'auto' }}>
                    <SharedTable
                      dataSource={classes}
                      columns={classColumns}
                      rowKey="id"
                      scroll={{ x: 550 }}
                      pagination={false}
                      locale={{ emptyText: 'Not assigned to any classes' }}
                    />
                  </div>
                ),
              },
              {
                key: 'attendance',
                label: `Attendance (${attendance.length})`,
                children: (
                  <div style={{ padding: '0 0 16px', overflowX: 'auto' }}>
                    <SharedTable
                      dataSource={attendance}
                      columns={attendanceColumns}
                      rowKey="id"
                      scroll={{ x: 550 }}
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      locale={{ emptyText: 'No attendance records' }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

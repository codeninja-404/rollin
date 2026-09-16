'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Table, Typography, Progress, Tag, Select, Tabs, Spin, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;
const { Option } = Select;

interface ClassReport {
  class_id: string;
  class_name: string;
  course_code: string;
  total_students: number;
  total_sessions: number;
  total_attendances: number;
  avg_percent: number;
}

interface StudentReport {
  student_id: string;
  student_name: string;
  student_code: string;
  class_name: string;
  sessions: number;
  present: number;
  percent: number;
}

export default function ReportsPage() {
  const [classReports, setClassReports] = useState<ClassReport[]>([]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/reports');
        const data = await res.json();
        setClassReports(data.classReports ?? []);
        setStudentReports(data.studentReports ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const classColumns: ColumnsType<ClassReport> = [
    {
      title: 'Class',
      key: 'class',
      render: (_, r) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{r.class_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.course_code}</Text>
        </div>
      ),
    },
    { title: 'Students', dataIndex: 'total_students', render: (v: number) => <Text style={{ color: '#fff' }}>{v}</Text> },
    { title: 'Sessions', dataIndex: 'total_sessions', render: (v: number) => <Text style={{ color: '#fff' }}>{v}</Text> },
    {
      title: 'Avg Attendance',
      dataIndex: 'avg_percent',
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Progress
            percent={v}
            size="small"
            strokeColor={v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444'}
            showInfo={false}
            style={{ width: 80 }}
          />
          <Text style={{ color: '#fff', fontWeight: 600 }}>{v}%</Text>
        </div>
      ),
    },
  ];

  const studentColumns: ColumnsType<StudentReport> = [
    {
      title: 'Student',
      key: 'student',
      render: (_, r) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{r.student_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.student_code}</Text>
        </div>
      ),
    },
    { title: 'Class', dataIndex: 'class_name', render: (v: string) => <Text type="secondary">{v}</Text> },
    {
      title: 'Present / Sessions',
      key: 'counts',
      render: (_, r) => <Text style={{ color: '#fff' }}>{r.present} / {r.sessions}</Text>,
    },
    {
      title: 'Attendance',
      dataIndex: 'percent',
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Progress
            percent={v}
            size="small"
            strokeColor={v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444'}
            showInfo={false}
            style={{ width: 80 }}
          />
          <Tag
            color={v >= 75 ? 'green' : v >= 50 ? 'orange' : 'red'}
            style={{ borderRadius: 6 }}
          >
            {v}%
          </Tag>
        </div>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Reports</Title>
          <Text type="secondary">Attendance analytics and summaries</Text>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : (
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
                  label: 'By Class',
                  children: (
                    <Table
                      dataSource={classReports}
                      columns={classColumns}
                      rowKey="class_id"
                      pagination={{ pageSize: 15, showSizeChanger: false }}
                      locale={{ emptyText: 'No data yet' }}
                      style={{ padding: '0 0 16px' }}
                    />
                  ),
                },
                {
                  key: 'students',
                  label: 'By Student',
                  children: (
                    <Table
                      dataSource={studentReports}
                      columns={studentColumns}
                      rowKey={(r) => `${r.student_id}-${r.class_name}`}
                      pagination={{ pageSize: 15, showSizeChanger: false }}
                      locale={{ emptyText: 'No data yet' }}
                      style={{ padding: '0 0 16px' }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        )}
      </div>
    </AntdConfigProvider>
  );
}

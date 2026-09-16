'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Checkbox, Typography, Input, Avatar,
  message,
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { Student, ClassStudent } from '@/lib/types';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;

export default function AssignStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const [classId, setClassId] = useState('');
  const [className, setClassName] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [studRes, classRes] = await Promise.all([
        fetch('/api/admin/students'),
        fetch(`/api/admin/classes/${id}`),
      ]);
      const studData = await studRes.json();
      const classData = await classRes.json();
      setAllStudents(studData.students ?? []);
      setClassName(classData.class?.name ?? 'Class');

      const assignedIds = new Set<string>(
        (classData.assignedStudents ?? []).map((cs: ClassStudent) => cs.student_id),
      );
      setAssigned(assignedIds);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    params.then(({ id }) => {
      setClassId(id);
      load(id);
    });
  }, [params, load]);

  const filtered = allStudents.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_code.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleStudent = async (studentId: string, isAssigned: boolean) => {
    setSaving(true);
    try {
      const method = isAssigned ? 'DELETE' : 'POST';
      const res = await fetch(`/api/admin/classes/${classId}/students`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      if (res.ok) {
        setAssigned((prev) => {
          const next = new Set(prev);
          if (isAssigned) next.delete(studentId);
          else next.add(studentId);
          return next;
        });
      } else {
        message.error('Failed to update assignment');
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Assigned',
      key: 'assigned',
      width: 80,
      align: 'center' as const,
      render: (_: any, s: Student) => (
        <Checkbox
          checked={assigned.has(s.id)}
          onChange={() => toggleStudent(s.id, assigned.has(s.id))}
          disabled={saving}
        />
      ),
    },
    {
      title: 'Student',
      key: 'student',
      width: 220,
      render: (_: any, s: Student) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={26}
            style={{
              background: '#2563EB',
              color: '#FFFFFF',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 0,
            }}
          >
            {s.name.charAt(0)}
          </Avatar>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ color: '#111111', fontWeight: 600, fontSize: 13 }}>{s.name}</div>
            <span style={{ color: '#6B6B6B', fontSize: 11 }}>{s.student_code}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 220,
      render: (e: string) => <span style={{ color: '#111111', fontSize: 12 }}>{e}</span>,
    },
    {
      title: 'Dept',
      dataIndex: 'department',
      width: 100,
      render: (d: string) => <span style={{ color: '#6B6B6B', fontSize: 12 }}>{d ?? '—'}</span>,
    },
    {
      title: 'Section',
      dataIndex: 'section',
      width: 90,
      render: (s: string) => <span style={{ color: '#6B6B6B', fontSize: 12 }}>{s ? `Sec ${s}` : '—'}</span>,
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>Manage Students</Title>
            <Text type="secondary" style={{ color: '#6B6B6B' }}>{className} — {assigned.size} students enrolled</Text>
          </div>
          <Button
            onClick={() => router.push(`/admin/classes/${classId}`)}
            style={{ borderRadius: 0, height: 36, borderColor: '#E4E4E4', color: '#111111' }}
          >
            Back to Class
          </Button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#6B6B6B' }} />}
            placeholder="Search students to assign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              maxWidth: 360,
              height: 36,
              borderRadius: 0,
              background: '#FFFFFF',
              borderColor: '#E4E4E4',
              color: '#111111',
            }}
          />
        </div>

        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: 0,
            overflow: 'hidden',
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 710 }}
            pagination={{ pageSize: 20, showSizeChanger: false, style: { padding: '8px 16px', margin: 0 } }}
            rowClassName={(s) => assigned.has(s.id) ? 'bg-blue-50/50' : ''}
          />
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Checkbox, Typography, Input, Tag, Avatar,
  Space, message, Spin, Alert,
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
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
      render: (_: any, s: Student) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={26}
            style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {s.name.charAt(0)}
          </Avatar>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 12.5, lineHeight: 1.2 }}>{s.name}</div>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.1 }}>{s.student_code}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      render: (e: string) => <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{e}</span>,
    },
    {
      title: 'Dept',
      dataIndex: 'department',
      render: (d: string) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{d ?? '—'}</span>,
    },
    {
      title: 'Section',
      dataIndex: 'section',
      render: (s: string) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{s ? `Sec ${s}` : '—'}</span>,
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Manage Students</Title>
            <Text type="secondary">{className} — {assigned.size} students enrolled</Text>
          </div>
          <Button onClick={() => router.push(`/admin/classes/${classId}`)} style={{ borderRadius: 8, height: 36 }}>
            Back to Class
          </Button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
            placeholder="Search students to assign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360, height: 36, borderRadius: 8 }}
          />
        </div>

        <Card
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
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
            pagination={{ pageSize: 20, showSizeChanger: false, style: { padding: '8px 16px', margin: 0 } }}
            rowClassName={(s) => assigned.has(s.id) ? 'row-assigned' : ''}
          />
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

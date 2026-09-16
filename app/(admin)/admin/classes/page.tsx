'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Typography, Tag, Modal, Form, Input,
  Select, Space, Dropdown, message, Empty,
} from 'antd';
import {
  BookOutlined, PlusOutlined, MoreOutlined, TeamOutlined,
  EyeOutlined, EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Class } from '@/lib/types';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;
const { Option } = Select;

const DEPARTMENTS = ['CSE', 'EEE', 'ME', 'CE', 'BBA', 'ENG', 'LAW', 'PHY', 'MATH'];

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/classes');
      const data = await res.json();
      setClasses(data.classes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        message.success('Class created');
        setModalOpen(false);
        form.resetFields();
        load();
      } else {
        const data = await res.json();
        message.error(data.error ?? 'Failed to create class');
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<Class> = [
    {
      title: 'Class',
      key: 'class',
      render: (_, c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            fontSize: 18,
          }}>
            <BookOutlined />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{c.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{c.course_code}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      render: (v: string) => <Text type="secondary">{v ?? '—'}</Text>,
    },
    {
      title: 'Semester / Section',
      key: 'sem',
      render: (_, c) => (
        <Text type="secondary">
          {[c.semester && `Sem ${c.semester}`, c.section && `Sec ${c.section}`].filter(Boolean).join(' · ') || '—'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'default'} style={{ borderRadius: 6 }}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v).format('MMM D, YYYY')}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, c) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view', icon: <EyeOutlined />, label: 'View Class', onClick: () => router.push(`/admin/classes/${c.id}`) },
              { key: 'students', icon: <TeamOutlined />, label: 'Manage Students', onClick: () => router.push(`/admin/classes/${c.id}/students`) },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} style={{ color: 'rgba(255,255,255,0.5)' }} />
        </Dropdown>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Classes</Title>
            <Text type="secondary">{classes.length} classes total</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none',
              borderRadius: 10,
              height: 40,
              fontWeight: 600,
            }}
          >
            Create Class
          </Button>
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
            dataSource={classes}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            onRow={(c) => ({ onClick: () => router.push(`/admin/classes/${c.id}`), style: { cursor: 'pointer' } })}
            locale={{ emptyText: 'No classes yet. Create one to get started.' }}
          />
        </Card>

        {/* Create class modal */}
        <Modal
          title={<Text strong style={{ color: '#fff', fontSize: 16 }}>Create New Class</Text>}
          open={modalOpen}
          onCancel={() => { setModalOpen(false); form.resetFields(); }}
          footer={null}
          styles={{ content: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
            <Form.Item name="course_code" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Course Code</Text>} rules={[{ required: true }]}>
              <Input placeholder="e.g. CSE101" style={{ borderRadius: 8, height: 40 }} />
            </Form.Item>
            <Form.Item name="name" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Course Name</Text>} rules={[{ required: true }]}>
              <Input placeholder="e.g. Data Structures" style={{ borderRadius: 8, height: 40 }} />
            </Form.Item>
            <Form.Item name="department" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Department</Text>}>
              <Select placeholder="Select department" style={{ borderRadius: 8 }}>
                {DEPARTMENTS.map((d) => <Option key={d} value={d}>{d}</Option>)}
              </Select>
            </Form.Item>
            <Space style={{ width: '100%' }}>
              <Form.Item name="semester" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Semester</Text>} style={{ flex: 1 }}>
                <Select placeholder="Semester">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <Option key={n} value={n}>Semester {n}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="section" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Section</Text>} style={{ flex: 1 }}>
                <Input placeholder="A, B, C…" style={{ borderRadius: 8, height: 40 }} />
              </Form.Item>
            </Space>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8 }}
                >
                  Create Class
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AntdConfigProvider>
  );
}

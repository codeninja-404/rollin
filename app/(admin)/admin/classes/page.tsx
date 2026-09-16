'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Typography, Tag, Modal, Form, Input,
  Select, Space, Dropdown, message, Empty, Row, Col,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            fontSize: 13,
            flexShrink: 0,
          }}>
            <BookOutlined />
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 12.5, lineHeight: 1.2 }}>{c.name}</div>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.1 }}>{c.course_code}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      render: (v: string) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{v ?? '—'}</span>,
    },
    {
      title: 'Semester / Section',
      key: 'sem',
      render: (_, c) => (
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          {[c.semester && `Sem ${c.semester}`, c.section && `Sec ${c.section}`].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      align: 'center',
      width: 85,
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'default'} style={{ borderRadius: 4, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px' }}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      align: 'center',
      width: 105,
      render: (v: string) => (
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5 }}>{dayjs(v).format('MMM D, YYYY')}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 44,
      align: 'center',
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
          <Button type="text" size="small" icon={<MoreOutlined />} style={{ color: 'rgba(255,255,255,0.5)', width: 24, height: 24, padding: 0 }} />
        </Dropdown>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
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
              height: 38,
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
            borderRadius: 14,
            overflow: 'hidden',
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            dataSource={classes}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false, style: { padding: '8px 16px', margin: 0 } }}
            onRow={(c) => ({ onClick: () => router.push(`/admin/classes/${c.id}`), style: { cursor: 'pointer' } })}
            locale={{ emptyText: 'No classes yet. Create one to get started.' }}
          />
        </Card>

        {/* Create class modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                fontSize: 18,
              }}>
                <BookOutlined />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Create New Class</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Define course code, name, department, and section</Text>
              </div>
            </div>
          }
          open={modalOpen}
          onCancel={() => { setModalOpen(false); form.resetFields(); }}
          footer={null}
          width={560}
          styles={{ body: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 20 }}>
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={10}>
                <Form.Item
                  name="course_code"
                  label={<Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Course Code</Text>}
                  rules={[{ required: true, message: 'Please enter course code' }]}
                >
                  <Input placeholder="e.g. CSE101" style={{ borderRadius: 8, height: 42 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={14}>
                <Form.Item
                  name="name"
                  label={<Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Course Name</Text>}
                  rules={[{ required: true, message: 'Please enter course name' }]}
                >
                  <Input placeholder="e.g. Data Structures & Algorithms" style={{ borderRadius: 8, height: 42 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="department"
              label={<Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Department</Text>}
            >
              <Select placeholder="Select department" style={{ borderRadius: 8, height: 42 }}>
                {DEPARTMENTS.map((d) => <Option key={d} value={d}>{d}</Option>)}
              </Select>
            </Form.Item>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="semester"
                  label={<Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Semester</Text>}
                >
                  <Select placeholder="Select semester" style={{ width: '100%', borderRadius: 8, height: 42 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <Option key={n} value={n}>Semester {n}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="section"
                  label={<Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Section</Text>}
                >
                  <Input placeholder="e.g. A, B, C…" style={{ borderRadius: 8, height: 42 }} />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <Button
                onClick={() => { setModalOpen(false); form.resetFields(); }}
                style={{ height: 40, borderRadius: 8 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: 8,
                  height: 40,
                  padding: '0 24px',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                }}
              >
                Create Class
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </AntdConfigProvider>
  );
}

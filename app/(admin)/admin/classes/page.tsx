'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Button, Typography, Tag, Modal, Form, Input,
  Select, Space, Dropdown, message, Row, Col,
} from 'antd';
import {
  BookOutlined, PlusOutlined, MoreOutlined, TeamOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Class } from '@/lib/types';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import SharedTable from '@/components/SharedTable';

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
      width: 220,
      render: (_, c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 0,
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563EB',
            fontSize: 13,
            flexShrink: 0,
          }}>
            <BookOutlined />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ color: '#111111', fontWeight: 600, fontSize: 13 }}>{c.name}</div>
            <span style={{ color: '#6B6B6B', fontSize: 11 }}>{c.course_code}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      width: 140,
      render: (v: string) => <span style={{ color: '#111111', fontSize: 12 }}>{v ?? '—'}</span>,
    },
    {
      title: 'Semester / Section',
      key: 'sem',
      width: 160,
      render: (_, c) => (
        <span style={{ color: '#6B6B6B', fontSize: 12 }}>
          {[c.semester && `Sem ${c.semester}`, c.section && `Sec ${c.section}`].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      align: 'center',
      width: 90,
      render: (s: string) => (
        <Tag
          color={s === 'active' ? 'success' : 'default'}
          style={{ borderRadius: 0, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px', fontWeight: 600 }}
        >
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      align: 'center',
      width: 110,
      render: (v: string) => (
        <span style={{ color: '#6B6B6B', fontSize: 12 }}>{dayjs(v).format('MMM D, YYYY')}</span>
      ),
    },
    {
      title: 'Action',
      key: 'actions',
      width: 70,
      align: 'center',
      fixed: 'right' as const,
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
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            style={{ color: '#6B6B6B', width: 24, height: 24, padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>Classes</Title>
            <Text type="secondary" style={{ color: '#6B6B6B' }}>{classes.length} classes total</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            style={{
              background: '#2563EB',
              borderColor: '#2563EB',
              borderRadius: 0,
              height: 36,
              fontWeight: 600,
            }}
          >
            Create Class
          </Button>
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
          <SharedTable
            dataSource={classes}
            columns={columns}
            rowKey="id"
            loading={loading}
            scroll={{ x: 790 }}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            onRow={(c) => ({ onClick: () => router.push(`/admin/classes/${c.id}`), style: { cursor: 'pointer' } })}
            locale={{ emptyText: 'No classes yet. Create one to get started.' }}
          />
        </Card>

        {/* Create class modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 0,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB',
                fontSize: 16,
              }}>
                <BookOutlined />
              </div>
              <div>
                <div style={{ color: '#111111', fontSize: 16, fontWeight: 700 }}>Create New Class</div>
                <Text type="secondary" style={{ fontSize: 12, color: '#6B6B6B' }}>Define course code, name, department, and section</Text>
              </div>
            </div>
          }
          open={modalOpen}
          onCancel={() => { setModalOpen(false); form.resetFields(); }}
          footer={null}
          width={560}
          styles={{ body: { background: '#FFFFFF' }, header: { background: '#FFFFFF' } }}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={10}>
                <Form.Item
                  name="course_code"
                  label={<Text style={{ color: '#111111', fontWeight: 500 }}>Course Code</Text>}
                  rules={[{ required: true, message: 'Please enter course code' }]}
                >
                  <Input placeholder="e.g. CSE101" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={14}>
                <Form.Item
                  name="name"
                  label={<Text style={{ color: '#111111', fontWeight: 500 }}>Course Name</Text>}
                  rules={[{ required: true, message: 'Please enter course name' }]}
                >
                  <Input placeholder="e.g. Data Structures & Algorithms" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="department"
              label={<Text style={{ color: '#111111', fontWeight: 500 }}>Department</Text>}
            >
              <Select placeholder="Select department" style={{ borderRadius: 0, height: 38 }}>
                {DEPARTMENTS.map((d) => <Option key={d} value={d}>{d}</Option>)}
              </Select>
            </Form.Item>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="semester"
                  label={<Text style={{ color: '#111111', fontWeight: 500 }}>Semester</Text>}
                >
                  <Select placeholder="Select semester" style={{ width: '100%', borderRadius: 0, height: 38 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <Option key={n} value={n}>Semester {n}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="section"
                  label={<Text style={{ color: '#111111', fontWeight: 500 }}>Section</Text>}
                >
                  <Input placeholder="e.g. A, B, C…" style={{ borderRadius: 0, height: 38 }} />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <Button
                onClick={() => { setModalOpen(false); form.resetFields(); }}
                style={{ height: 38, borderRadius: 0 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                style={{
                  background: '#2563EB',
                  borderColor: '#2563EB',
                  border: 'none',
                  borderRadius: 0,
                  height: 38,
                  padding: '0 24px',
                  fontWeight: 600,
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

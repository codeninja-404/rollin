'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Tag, Space,
  message, Dropdown, Typography, Switch,
} from 'antd';
import {
  PlusOutlined, WifiOutlined, MoreOutlined,
  DeleteOutlined, EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { CampusNetwork } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;

export default function NetworksPage() {
  const [networks, setNetworks] = useState<CampusNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/networks');
      const data = await res.json();
      setNetworks(data.networks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/networks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        message.success('Network added');
        setModalOpen(false);
        form.resetFields();
        load();
      } else {
        const data = await res.json();
        message.error(data.error ?? 'Failed to add network');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete this network?',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await fetch(`/api/admin/networks/${id}`, { method: 'DELETE' });
        if (res.ok) {
          message.success('Network deleted');
          load();
        }
      },
    });
  };

  const handleToggle = async (id: string, current: string) => {
    const newStatus = current === 'active' ? 'inactive' : 'active';
    await fetch(`/api/admin/networks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  };

  const columns: ColumnsType<CampusNetwork> = [
    {
      title: 'Network',
      key: 'network',
      render: (_, n) => (
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
            <WifiOutlined />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{n.name}</div>
            <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{n.cidr}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string, n) => (
        <Switch
          checked={s === 'active'}
          onChange={() => handleToggle(n.id, s)}
          checkedChildren="Active"
          unCheckedChildren="Off"
          style={{ background: s === 'active' ? '#10b981' : undefined }}
        />
      ),
    },
    {
      title: 'Added',
      dataIndex: 'created_at',
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(v).format('MMM D, YYYY')}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, n) => (
        <Button
          type="text"
          icon={<DeleteOutlined />}
          danger
          size="small"
          onClick={() => handleDelete(n.id)}
        />
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Campus Networks</Title>
            <Text type="secondary">Configure allowed IP ranges for attendance submission</Text>
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
            Add Network
          </Button>
        </div>

        <Card
          style={{
            background: 'rgba(16,185,129,0.05)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 14,
            marginBottom: 20,
          }}
          styles={{ body: { padding: '14px 20px' } }}
        >
          <Text style={{ color: '#34d399' }}>
            💡 Loopback (127.0.0.1) and private ranges (10.x, 192.168.x) are always allowed for local development.
            If no networks are configured, all IPs are allowed.
          </Text>
        </Card>

        <Card
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            dataSource={networks}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{ emptyText: 'No networks configured. All IPs are currently allowed.' }}
          />
        </Card>

        <Modal
          title={<Text strong style={{ color: '#fff', fontSize: 16 }}>Add Campus Network</Text>}
          open={modalOpen}
          onCancel={() => { setModalOpen(false); form.resetFields(); }}
          footer={null}
          styles={{ body: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
            <Form.Item
              name="name"
              label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>Network Name</Text>}
              rules={[{ required: true }]}
            >
              <Input placeholder="e.g. Main Campus WiFi" style={{ borderRadius: 8, height: 40 }} />
            </Form.Item>
            <Form.Item
              name="cidr"
              label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>CIDR Range</Text>}
              rules={[
                { required: true },
                {
                  pattern: /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
                  message: 'Enter a valid CIDR, e.g. 103.10.20.0/24',
                },
              ]}
            >
              <Input
                placeholder="e.g. 103.10.20.0/24"
                style={{ borderRadius: 8, height: 40, fontFamily: 'monospace' }}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancel</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 8 }}
                >
                  Add Network
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AntdConfigProvider>
  );
}

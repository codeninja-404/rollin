'use client';

import React, { useEffect, useState } from 'react';
import { Card, Typography, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AuditLog } from '@/lib/types';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import SharedTable from '@/components/SharedTable';

const { Title, Text } = Typography;

const actionColors: Record<string, string> = {
  'admin.login': 'blue',
  'student.import': 'cyan',
  'class.create': 'purple',
  'student.assign': 'geekblue',
  'student.unassign': 'orange',
  'attendance.open': 'green',
  'attendance.close': 'red',
  'attendance.submit': 'lime',
  'network.create': 'volcano',
  'network.delete': 'magenta',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/audit');
        const data = await res.json();
        setLogs(data.logs ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'Action',
      dataIndex: 'action',
      width: 160,
      render: (action: string) => (
        <Tag
          color={actionColors[action] ?? 'default'}
          style={{ borderRadius: 0, fontFamily: 'monospace', fontSize: 11 }}
        >
          {action}
        </Tag>
      ),
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 160,
      render: (_, log) => (
        log.entity ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {log.entity}
            {log.entity_id && ` · ${log.entity_id.slice(0, 8)}…`}
          </Text>
        ) : <Text type="secondary">—</Text>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      width: 130,
      render: (ip: string) => (
        <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>{ip ?? '—'}</Text>
      ),
    },
    {
      title: 'Metadata',
      dataIndex: 'metadata',
      width: 90,
      render: (meta: any) => meta ? (
        <Tooltip title={<pre style={{ fontSize: 11 }}>{JSON.stringify(meta, null, 2)}</pre>}>
          <Text type="secondary" style={{ fontSize: 11, cursor: 'pointer', textDecoration: 'underline dotted' }}>
            view
          </Text>
        </Tooltip>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Time',
      dataIndex: 'created_at',
      width: 180,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(v).format('MMM D, YYYY h:mm:ss A')}
        </Text>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>Audit Logs</Title>
          <Text type="secondary">System activity trail</Text>
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
            dataSource={logs}
            columns={columns}
            rowKey="id"
            loading={loading}
            scroll={{ x: 720 }}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: 'No audit logs yet' }}
          />
        </Card>
      </div>
    </AntdConfigProvider>
  );
}

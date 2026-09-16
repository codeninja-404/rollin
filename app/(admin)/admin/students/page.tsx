'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Input, Tag, Space, Typography, Modal,
  Upload, Alert, Progress, message, Tooltip, Avatar, Badge,
  Dropdown, Switch,
} from 'antd';
import {
  TeamOutlined, SearchOutlined, UploadOutlined, UserAddOutlined,
  MoreOutlined, EyeOutlined, DeleteOutlined, ImportOutlined,
  CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import Papa from 'papaparse';
import type { ColumnsType } from 'antd/es/table';
import type { Student, CsvStudentRow } from '@/lib/types';
import { useRouter } from 'next/navigation';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface CsvPreviewRow extends CsvStudentRow {
  _status: 'valid' | 'duplicate' | 'invalid';
  _error?: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/students');
      const data = await res.json();
      setStudents(data.students ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_code.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCsvFile = (file: File) => {
    Papa.parse<CsvStudentRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const existingEmails = new Set(students.map((s) => s.email.toLowerCase()));
        const existingCodes = new Set(students.map((s) => s.student_code.toLowerCase()));
        const seen = new Set<string>();

        const preview: CsvPreviewRow[] = results.data.map((row) => {
          if (!row.student_code || !row.name || !row.email) {
            return { ...row, _status: 'invalid', _error: 'Missing required fields' };
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            return { ...row, _status: 'invalid', _error: 'Invalid email' };
          }
          const key = `${row.email.toLowerCase()}|${row.student_code.toLowerCase()}`;
          if (existingEmails.has(row.email.toLowerCase()) || existingCodes.has(row.student_code.toLowerCase()) || seen.has(key)) {
            return { ...row, _status: 'duplicate', _error: 'Already exists' };
          }
          seen.add(key);
          return { ...row, _status: 'valid' };
        });

        setCsvPreview(preview);
        setImportOpen(true);
      },
    });
    return false; // prevent auto-upload
  };

  const handleImport = async () => {
    const valid = csvPreview.filter((r) => r._status === 'valid');
    if (!valid.length) return;

    setImporting(true);
    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: valid }),
      });
      const data = await res.json();
      if (res.ok) {
        message.success(`Imported ${data.imported} students`);
        setImportDone(true);
        load();
      } else {
        message.error(data.error ?? 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    setCsvPreview([]);
    setImportDone(false);
  };

  const validCount = csvPreview.filter((r) => r._status === 'valid').length;
  const dupCount = csvPreview.filter((r) => r._status === 'duplicate').length;
  const invalidCount = csvPreview.filter((r) => r._status === 'invalid').length;

  const columns: ColumnsType<Student> = [
    {
      title: 'Student',
      key: 'student',
      render: (_, s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', flexShrink: 0 }}
            size={36}
          >
            {s.name.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{s.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{s.student_code}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => <Text type="secondary">{email}</Text>,
    },
    {
      title: 'Dept / Semester',
      key: 'dept',
      render: (_, s) => (
        <Text type="secondary">
          {[s.department, s.semester && `Sem ${s.semester}`, s.section && `Sec ${s.section}`]
            .filter(Boolean).join(' · ')}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'} style={{ borderRadius: 6 }}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(val).format('MMM D, YYYY')}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, s) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view', icon: <EyeOutlined />, label: 'View Details', onClick: () => router.push(`/admin/students/${s.id}`) },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} style={{ color: 'rgba(255,255,255,0.5)' }} />
        </Dropdown>
      ),
    },
  ];

  const previewColumns: ColumnsType<CsvPreviewRow> = [
    {
      title: 'Status',
      key: '_status',
      width: 90,
      render: (_, r) => {
        const icon = r._status === 'valid' ? <CheckCircleOutlined style={{ color: '#10b981' }} /> :
          r._status === 'duplicate' ? <WarningOutlined style={{ color: '#f59e0b' }} /> :
            <CloseCircleOutlined style={{ color: '#ef4444' }} />;
        return <Tooltip title={r._error}>{icon}</Tooltip>;
      },
    },
    { title: 'Code', dataIndex: 'student_code', key: 'student_code', width: 100 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Dept', dataIndex: 'department', key: 'department', width: 80 },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Students</Title>
            <Text type="secondary">{students.length} students total</Text>
          </div>
          <Upload accept=".csv" beforeUpload={handleCsvFile} showUploadList={false}>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              style={{
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border: 'none',
                borderRadius: 10,
                height: 40,
                fontWeight: 600,
              }}
            >
              Import CSV
            </Button>
          </Upload>
        </div>

        {/* Search */}
        <Input
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
          placeholder="Search by name, code, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginBottom: 20,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#fff',
            maxWidth: 400,
            height: 42,
          }}
        />

        <Card
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
          }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: 'No students yet. Import a CSV to get started.' }}
          />
        </Card>

        {/* CSV Import Modal */}
        <Modal
          title={
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              Import Students from CSV
            </Text>
          }
          open={importOpen}
          onCancel={closeImport}
          footer={
            importDone ? (
              <Button type="primary" onClick={closeImport} style={{ borderRadius: 8 }}>
                Done
              </Button>
            ) : (
              <Space>
                <Button onClick={closeImport}>Cancel</Button>
                <Button
                  type="primary"
                  loading={importing}
                  disabled={validCount === 0}
                  onClick={handleImport}
                  style={{
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    border: 'none',
                    borderRadius: 8,
                  }}
                >
                  Import {validCount} Students
                </Button>
              </Space>
            )
          }
          width={760}
          styles={{ content: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
        >
          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <Tag color="green" style={{ borderRadius: 6, padding: '4px 10px' }}>
              <CheckCircleOutlined /> Valid: {validCount}
            </Tag>
            <Tag color="orange" style={{ borderRadius: 6, padding: '4px 10px' }}>
              <WarningOutlined /> Duplicates: {dupCount}
            </Tag>
            <Tag color="red" style={{ borderRadius: 6, padding: '4px 10px' }}>
              <CloseCircleOutlined /> Invalid: {invalidCount}
            </Tag>
          </div>

          <Alert
            type="info"
            message="Required columns: student_code, name, email. Optional: department, semester, section"
            style={{ borderRadius: 8, marginBottom: 16 }}
          />

          <Table
            dataSource={csvPreview}
            columns={previewColumns}
            rowKey={(r) => r.email || Math.random().toString()}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            size="small"
            rowClassName={(r) =>
              r._status === 'valid' ? '' : r._status === 'duplicate' ? 'row-warning' : 'row-error'
            }
          />
        </Modal>
      </div>
    </AntdConfigProvider>
  );
}

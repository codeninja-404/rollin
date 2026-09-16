'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Input, Tag, Space, Typography, Modal,
  Upload, Alert, Progress, message, Tooltip, Avatar, Badge,
  Dropdown, Switch, Form, Select, InputNumber, Row, Col,
} from 'antd';
import {
  TeamOutlined, SearchOutlined, UploadOutlined, UserAddOutlined,
  MoreOutlined, EyeOutlined, DeleteOutlined, ImportOutlined,
  CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  DownloadOutlined, PlusOutlined,
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

  // Manual Add Student modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm] = Form.useForm();

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

  const downloadSampleCsv = () => {
    const csvContent = `student_code,name,email,department,semester,section
STU001,Aryan Khan,aryan.khan@university.edu,CSE,3,A
STU002,Priya Sharma,priya.sharma@university.edu,CSE,3,A
STU003,Rahul Mehta,rahul.mehta@university.edu,CSE,3,A
STU004,Sneha Patel,sneha.patel@university.edu,CSE,3,A
STU005,Aditya Roy,aditya.roy@university.edu,CSE,3,B
STU006,Meera Nair,meera.nair@university.edu,CSE,3,B
STU007,Karan Joshi,karan.joshi@university.edu,CSE,3,B
STU008,Ananya Singh,ananya.singh@university.edu,CSE,3,B
STU009,Vikram Das,vikram.das@university.edu,EEE,3,A
STU010,Pooja Reddy,pooja.reddy@university.edu,EEE,3,A
STU011,Rohan Gupta,rohan.gupta@university.edu,EEE,3,A
STU012,Divya Kumar,divya.kumar@university.edu,EEE,3,A
STU013,Saurabh Yadav,saurabh.yadav@university.edu,ME,5,A
STU014,Nisha Bose,nisha.bose@university.edu,ME,5,A
STU015,Tarun Pillai,tarun.pillai@university.edu,ME,5,B
STU016,Kavya Iyer,kavya.iyer@university.edu,BBA,1,A
STU017,Harish Verma,harish.verma@university.edu,BBA,1,A
STU018,Leena Thomas,leena.thomas@university.edu,BBA,1,B
STU019,Nikhil Sharma,nikhil.sharma@university.edu,CSE,5,A
STU020,Swati Mishra,swati.mishra@university.edu,CSE,5,A`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'dummy_students.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Dummy students CSV downloaded!');
  };

  const handleManualAdd = async (values: any) => {
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        message.success(`Student ${data.student.name} added successfully!`);
        addForm.resetFields();
        setAddOpen(false);
        load();
      } else {
        message.error(data.error || 'Failed to add student');
      }
    } catch {
      message.error('An error occurred while adding student');
    } finally {
      setAddLoading(false);
    }
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
      render: (email: string) => <Text style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</Text>,
    },
    {
      title: 'Department / Class Info',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Students</Title>
            <Text type="secondary">{students.length} students total</Text>
          </div>

          <Space size={12}>
            {/* Download Sample CSV */}
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadSampleCsv}
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 10,
                height: 40,
                fontWeight: 500,
              }}
            >
              Dummy CSV
            </Button>

            {/* Manual Add Student */}
            <Button
              icon={<PlusOutlined />}
              onClick={() => setAddOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.15)',
                color: '#fff',
                borderRadius: 10,
                height: 40,
                fontWeight: 600,
              }}
            >
              Add Student
            </Button>

            {/* Import CSV */}
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
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                }}
              >
                Import CSV
              </Button>
            </Upload>
          </Space>
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
            locale={{ emptyText: 'No students yet. Import a CSV or manually add one.' }}
          />
        </Card>

        {/* Manual Add Student Modal */}
        <Modal
          title={
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              Add New Student
            </Text>
          }
          open={addOpen}
          onCancel={() => {
            setAddOpen(false);
            addForm.resetFields();
          }}
          footer={null}
          width={540}
          styles={{ body: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
        >
          <Form
            form={addForm}
            layout="vertical"
            onFinish={handleManualAdd}
            initialValues={{ department: 'CSE', semester: 1, section: 'A' }}
            style={{ marginTop: 16 }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<span style={{ color: '#fff' }}>Student Code / ID</span>}
                  name="student_code"
                  rules={[{ required: true, message: 'Student code is required' }]}
                >
                  <Input placeholder="e.g. STU001" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span style={{ color: '#fff' }}>Full Name</span>}
                  name="name"
                  rules={[{ required: true, message: 'Student name is required' }]}
                >
                  <Input placeholder="e.g. Aryan Khan" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={<span style={{ color: '#fff' }}>Email Address</span>}
              name="email"
              rules={[
                { required: true, message: 'Email is required' },
                { type: 'email', message: 'Enter a valid email' },
              ]}
            >
              <Input placeholder="e.g. aryan@university.edu" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label={<span style={{ color: '#fff' }}>Department</span>} name="department">
                  <Input placeholder="e.g. CSE" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={<span style={{ color: '#fff' }}>Semester</span>} name="semester">
                  <InputNumber min={1} max={12} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={<span style={{ color: '#fff' }}>Section</span>} name="section">
                  <Input placeholder="e.g. A" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button
                onClick={() => {
                  setAddOpen(false);
                  addForm.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={addLoading}
                style={{
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Create Student
              </Button>
            </div>
          </Form>
        </Modal>

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
          styles={{ body: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
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

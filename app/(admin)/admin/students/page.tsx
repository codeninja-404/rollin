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
  DownloadOutlined, PlusOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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

  const processRows = (rows: CsvStudentRow[]) => {
    const existingEmails = new Set(students.map((s) => s.email.toLowerCase()));
    const existingCodes = new Set(students.map((s) => s.student_code.toLowerCase()));
    const seen = new Set<string>();

    const preview: CsvPreviewRow[] = rows.map((row) => {
      const code = String(row.student_code ?? '').trim();
      const name = String(row.name ?? '').trim();
      const email = String(row.email ?? '').trim();

      if (!code || !name || !email) {
        return { ...row, student_code: code, name, email, _status: 'invalid', _error: 'Missing required fields' };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ...row, student_code: code, name, email, _status: 'invalid', _error: 'Invalid email' };
      }
      const key = `${email.toLowerCase()}|${code.toLowerCase()}`;
      if (existingEmails.has(email.toLowerCase()) || existingCodes.has(code.toLowerCase()) || seen.has(key)) {
        return { ...row, student_code: code, name, email, _status: 'duplicate', _error: 'Already exists' };
      }
      seen.add(key);
      return { ...row, student_code: code, name, email, _status: 'valid' };
    });

    setCsvPreview(preview);
    setImportOpen(true);
  };

  const handleFile = (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json<CsvStudentRow>(worksheet);
          processRows(rows);
        } catch (err) {
          message.error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<CsvStudentRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processRows(results.data);
        },
      });
    }
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

  const downloadSampleXlsx = () => {
    const sampleStudents = [
      { student_code: 'STU001', name: 'John Doe', email: 'john.doe@university.edu', department: 'CSE', semester: 3, section: 'A' },
      { student_code: 'STU002', name: 'Jane Doe', email: 'jane.doe@university.edu', department: 'CSE', semester: 3, section: 'A' },
      { student_code: 'STU003', name: 'John Doe', email: 'john.doe3@university.edu', department: 'CSE', semester: 3, section: 'A' },
      { student_code: 'STU004', name: 'Jane Doe', email: 'jane.doe4@university.edu', department: 'CSE', semester: 3, section: 'A' },
      { student_code: 'STU005', name: 'John Doe', email: 'john.doe5@university.edu', department: 'CSE', semester: 3, section: 'B' },
      { student_code: 'STU006', name: 'Jane Doe', email: 'jane.doe6@university.edu', department: 'CSE', semester: 3, section: 'B' },
      { student_code: 'STU007', name: 'John Doe', email: 'john.doe7@university.edu', department: 'CSE', semester: 3, section: 'B' },
      { student_code: 'STU008', name: 'Jane Doe', email: 'jane.doe8@university.edu', department: 'CSE', semester: 3, section: 'B' },
      { student_code: 'STU009', name: 'John Doe', email: 'john.doe9@university.edu', department: 'EEE', semester: 3, section: 'A' },
      { student_code: 'STU010', name: 'Jane Doe', email: 'jane.doe10@university.edu', department: 'EEE', semester: 3, section: 'A' },
      { student_code: 'STU011', name: 'John Doe', email: 'john.doe11@university.edu', department: 'EEE', semester: 3, section: 'A' },
      { student_code: 'STU012', name: 'Jane Doe', email: 'jane.doe12@university.edu', department: 'EEE', semester: 3, section: 'A' },
      { student_code: 'STU013', name: 'John Doe', email: 'john.doe13@university.edu', department: 'ME', semester: 5, section: 'A' },
      { student_code: 'STU014', name: 'Jane Doe', email: 'jane.doe14@university.edu', department: 'ME', semester: 5, section: 'A' },
      { student_code: 'STU015', name: 'John Doe', email: 'john.doe15@university.edu', department: 'ME', semester: 5, section: 'B' },
      { student_code: 'STU016', name: 'Jane Doe', email: 'jane.doe16@university.edu', department: 'BBA', semester: 1, section: 'A' },
      { student_code: 'STU017', name: 'John Doe', email: 'john.doe17@university.edu', department: 'BBA', semester: 1, section: 'A' },
      { student_code: 'STU018', name: 'Jane Doe', email: 'jane.doe18@university.edu', department: 'BBA', semester: 1, section: 'B' },
      { student_code: 'STU019', name: 'John Doe', email: 'john.doe19@university.edu', department: 'CSE', semester: 5, section: 'A' },
      { student_code: 'STU020', name: 'Jane Doe', email: 'jane.doe20@university.edu', department: 'CSE', semester: 5, section: 'A' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleStudents);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'dummy_students.xlsx');
    message.success('Dummy students XLSX downloaded!');
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
            {/* Download Sample XLSX */}
            <Button
              icon={<FileExcelOutlined />}
              onClick={downloadSampleXlsx}
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 10,
                height: 40,
                fontWeight: 500,
              }}
            >
              Sample XLSX
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

            {/* Import Excel / CSV */}
            <Upload accept=".xlsx,.xls,.csv" beforeUpload={handleFile} showUploadList={false}>
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
                Import Excel / CSV
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
            locale={{ emptyText: 'No students yet. Import an Excel / CSV file or manually add one.' }}
          />
        </Card>

        {/* Manual Add Student Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                  border: '1px solid rgba(99,102,241,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}
              >
                <UserAddOutlined style={{ fontSize: 18 }} />
              </div>
              <div>
                <Text strong style={{ color: '#fff', fontSize: 16, display: 'block' }}>
                  Add New Student
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Create a student record manually in the directory
                </Text>
              </div>
            </div>
          }
          open={addOpen}
          onCancel={() => {
            setAddOpen(false);
            addForm.resetFields();
          }}
          footer={null}
          width={580}
          styles={{ body: { background: '#1a1a2e' }, header: { background: '#1a1a2e' } }}
        >
          <Form
            form={addForm}
            layout="vertical"
            onFinish={handleManualAdd}
            initialValues={{ department: 'CSE', semester: 1, section: 'A' }}
            style={{ marginTop: 20 }}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ color: '#fff' }}>Student Code / ID</span>}
                  name="student_code"
                  rules={[{ required: true, message: 'Student code is required' }]}
                >
                  <Input placeholder="e.g. STU001" style={{ borderRadius: 8, height: 40 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ color: '#fff' }}>Full Name</span>}
                  name="name"
                  rules={[{ required: true, message: 'Student name is required' }]}
                >
                  <Input placeholder="e.g. John Doe" style={{ borderRadius: 8, height: 40 }} />
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
              <Input placeholder="e.g. john.doe@university.edu" style={{ borderRadius: 8, height: 40 }} />
            </Form.Item>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={8}>
                <Form.Item label={<span style={{ color: '#fff' }}>Department</span>} name="department">
                  <Input placeholder="e.g. CSE" style={{ borderRadius: 8, height: 40 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label={<span style={{ color: '#fff' }}>Semester</span>} name="semester">
                  <InputNumber min={1} max={12} style={{ width: '100%', borderRadius: 8, height: 40, paddingTop: 4 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label={<span style={{ color: '#fff' }}>Section</span>} name="section">
                  <Input placeholder="e.g. A" style={{ borderRadius: 8, height: 40 }} />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button
                onClick={() => {
                  setAddOpen(false);
                  addForm.resetFields();
                }}
                style={{ height: 40, borderRadius: 8 }}
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
                  height: 40,
                  padding: '0 24px',
                }}
              >
                Create Student
              </Button>
            </div>
          </Form>
        </Modal>

        {/* Excel / CSV Import Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                  border: '1px solid rgba(99,102,241,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}
              >
                <FileExcelOutlined style={{ fontSize: 18 }} />
              </div>
              <div>
                <Text strong style={{ color: '#fff', fontSize: 16, display: 'block' }}>
                  Import Students from Excel (XLSX) or CSV
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Review and import student records into the directory
                </Text>
              </div>
            </div>
          }
          open={importOpen}
          onCancel={closeImport}
          footer={
            importDone ? (
              <Button type="primary" onClick={closeImport} style={{ borderRadius: 8, height: 40 }}>
                Done
              </Button>
            ) : (
              <Space>
                <Button onClick={closeImport} style={{ borderRadius: 8, height: 40 }}>Cancel</Button>
                <Button
                  type="primary"
                  loading={importing}
                  disabled={validCount === 0}
                  onClick={handleImport}
                  style={{
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    border: 'none',
                    borderRadius: 8,
                    height: 40,
                    fontWeight: 600,
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
            message="Required columns: student_code, name, email. Optional: department, semester, section (.xlsx and .csv supported)"
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

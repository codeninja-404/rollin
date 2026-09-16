'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Input, Tag, Space, Typography, Modal,
  Upload, Alert, Progress, message, Tooltip, Avatar, Badge,
  Dropdown, Switch, Form, Select, InputNumber, Row, Col, Pagination,
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [semester, setSemester] = useState('all');
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('all');

  // Dynamic filter lists from API
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  // Modals state
  const [importOpen, setImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  // Manual Add Student modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm] = Form.useForm();

  const router = useRouter();

  const fetchStudents = useCallback(async (overrides?: {
    page?: number;
    pageSize?: number;
    search?: string;
    department?: string;
    semester?: string;
    section?: string;
    status?: string;
  }) => {
    setLoading(true);
    const targetPage = overrides?.page ?? page;
    const targetLimit = overrides?.pageSize ?? pageSize;
    const targetSearch = overrides?.search !== undefined ? overrides.search : appliedSearch;
    const targetDept = overrides?.department ?? department;
    const targetSem = overrides?.semester ?? semester;
    const targetSec = overrides?.section ?? section;
    const targetStatus = overrides?.status ?? status;

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(targetLimit),
      });
      if (targetSearch.trim()) params.set('search', targetSearch.trim());
      if (targetDept !== 'all') params.set('department', targetDept);
      if (targetSem !== 'all') params.set('semester', targetSem);
      if (targetSec !== 'all') params.set('section', targetSec);
      if (targetStatus !== 'all') params.set('status', targetStatus);

      const res = await fetch(`/api/admin/students?${params.toString()}`);
      const data = await res.json();
      setStudents(data.students ?? []);
      setTotal(data.total ?? 0);
      if (data.departments) setAvailableDepartments(data.departments);
      if (data.semesters) setAvailableSemesters(data.semesters);
      if (data.sections) setAvailableSections(data.sections);
    } catch {
      message.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, department, semester, section, status]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleApplyFilters = () => {
    if (appliedSearch === search && page === 1) {
      fetchStudents({ search, page: 1 });
    } else {
      setAppliedSearch(search);
      setPage(1);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setDepartment('all');
    setSemester('all');
    setSection('all');
    setStatus('all');
    setPage(1);
  };

  const handlePageChange = (newPage: number, newPageSize: number) => {
    if (newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setPage(1);
    } else {
      setPage(newPage);
    }
  };

  const processRows = (rows: CsvStudentRow[], existingEmails: Set<string>, existingCodes: Set<string>) => {
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

  const handleFile = async (file: File) => {
    let existingEmails = new Set<string>();
    let existingCodes = new Set<string>();

    try {
      const res = await fetch('/api/admin/students?all=true');
      const data = await res.json();
      const all: Student[] = data.students ?? [];
      existingEmails = new Set(all.map((s) => s.email.toLowerCase()));
      existingCodes = new Set(all.map((s) => s.student_code.toLowerCase()));
    } catch {
      // ignore
    }

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
          processRows(rows, existingEmails, existingCodes);
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
          processRows(results.data, existingEmails, existingCodes);
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
        fetchStudents({ page: 1 });
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

  const exportFilteredStudentsXLSX = async () => {
    setExportingAll(true);
    try {
      const params = new URLSearchParams({ all: 'true' });
      if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
      if (department !== 'all') params.set('department', department);
      if (semester !== 'all') params.set('semester', semester);
      if (section !== 'all') params.set('section', section);
      if (status !== 'all') params.set('status', status);

      const res = await fetch(`/api/admin/students?${params.toString()}`);
      const data = await res.json();
      const exportList: Student[] = data.students ?? [];

      if (exportList.length === 0) {
        message.warning('No students match the current filter criteria to export');
        return;
      }

      const rows = exportList.map((s) => ({
        'Student ID': s.student_code,
        'Name': s.name,
        'Email': s.email,
        'Department': s.department || '—',
        'Semester': s.semester ?? '—',
        'Section': s.section || '—',
        'Status': s.status.toUpperCase(),
        'Joined Date': dayjs(s.created_at).format('YYYY-MM-DD'),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      XLSX.writeFile(wb, `Rollin_Students_${dayjs().format('YYYY-MM-DD')}.xlsx`);
      message.success(`Exported ${exportList.length} students (.xlsx)!`);
    } catch (err) {
      message.error('Failed to export students');
    } finally {
      setExportingAll(false);
    }
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
        fetchStudents({ page: 1 });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
            }}
            size={26}
          >
            {s.name.charAt(0).toUpperCase()}
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
      key: 'email',
      render: (email: string) => <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{email}</span>,
    },
    {
      title: 'Department / Class Info',
      key: 'dept',
      render: (_, s) => (
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          {[s.department, s.semester && `Sem ${s.semester}`, s.section && `Sec ${s.section}`]
            .filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      width: 85,
      render: (st: string) => (
        <Tag color={st === 'active' ? 'green' : 'default'} style={{ borderRadius: 4, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px' }}>
          {st.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'created_at',
      key: 'created_at',
      align: 'center',
      width: 105,
      render: (val: string) => (
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5 }}>
          {dayjs(val).format('MMM D, YYYY')}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 44,
      align: 'center',
      render: (_, s) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view', icon: <EyeOutlined />, label: 'View Details', onClick: () => router.push(`/admin/students/${s.id}`) },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" icon={<MoreOutlined />} style={{ color: 'rgba(255,255,255,0.5)', width: 24, height: 24, padding: 0 }} />
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
        {/* Header with Title & Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>Students</Title>
            <Text type="secondary">{total} registered students total</Text>
          </div>

          <Space size={10} wrap>
            {/* Download Sample XLSX */}
            <Button
              icon={<FileExcelOutlined />}
              onClick={downloadSampleXlsx}
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 10,
                height: 38,
                fontWeight: 500,
              }}
            >
              Sample XLSX
            </Button>

            {/* Export Filtered Students */}
            <Button
              icon={<DownloadOutlined />}
              onClick={exportFilteredStudentsXLSX}
              loading={exportingAll}
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 10,
                height: 38,
                fontWeight: 500,
              }}
            >
              Export (XLSX)
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
                height: 38,
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
                  height: 38,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                }}
              >
                Import Excel / CSV
              </Button>
            </Upload>
          </Space>
        </div>

        {/* API-Managed Interactive Filters Bar */}
        <Card
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            marginBottom: 16,
          }}
          styles={{ body: { padding: '14px 16px' } }}
        >
          <Row gutter={[12, 10]} align="middle">
            <Col xs={24} sm={12} md={7}>
              <Input
                prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                placeholder="Search name, code, or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onPressEnter={handleApplyFilters}
                allowClear
                style={{
                  height: 36,
                  background: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#fff',
                }}
              />
            </Col>

            <Col xs={12} sm={6} md={4}>
              <Select
                value={department}
                onChange={(v) => {
                  setDepartment(v);
                  setPage(1);
                }}
                style={{ width: '100%' }}
                placeholder="Department"
              >
                <Select.Option value="all">All Depts</Select.Option>
                {availableDepartments.map((d) => (
                  <Select.Option key={d} value={d}>{d}</Select.Option>
                ))}
              </Select>
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Select
                value={semester}
                onChange={(v) => {
                  setSemester(v);
                  setPage(1);
                }}
                style={{ width: '100%' }}
                placeholder="Semester"
              >
                <Select.Option value="all">All Semesters</Select.Option>
                {availableSemesters.map((s) => (
                  <Select.Option key={s} value={String(s)}>Sem {s}</Select.Option>
                ))}
              </Select>
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Select
                value={section}
                onChange={(v) => {
                  setSection(v);
                  setPage(1);
                }}
                style={{ width: '100%' }}
                placeholder="Section"
              >
                <Select.Option value="all">All Secs</Select.Option>
                {availableSections.map((s) => (
                  <Select.Option key={s} value={s}>Sec {s}</Select.Option>
                ))}
              </Select>
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Select
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                style={{ width: '100%' }}
              >
                <Select.Option value="all">All Status</Select.Option>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="inactive">Inactive</Select.Option>
              </Select>
            </Col>

            <Col xs={24} sm={12} md={4} style={{ display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                onClick={handleApplyFilters}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                Filter
              </Button>
              <Button
                onClick={handleResetFilters}
                style={{
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Reset
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Compact Table with Standalone Server-Side Pagination */}
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
            dataSource={students}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            locale={{ emptyText: 'No students found matching current filters.' }}
          />

          {/* Dedicated Server-Side Pagination Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexWrap: 'wrap',
              gap: 10,
              background: 'rgba(255,255,255,0.015)',
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {total > 0
                ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} students`
                : '0 students'}
            </Text>

            <Pagination
              size="small"
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={['10', '20', '50', '100']}
              onChange={handlePageChange}
            />
          </div>
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

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Table, Typography, Progress, Tag, Select, Tabs, Input, Button,
  Row, Col, Statistic, Space, Empty, message, Tooltip,
} from 'antd';
import {
  BarChartOutlined, DownloadOutlined, FileExcelOutlined,
  SearchOutlined, AlertOutlined, CheckCircleOutlined,
  BookOutlined, UserOutlined, ClockCircleOutlined,
  FilterOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import StylishLoader from '@/components/StylishLoader';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface KPIStats {
  overallRate: number;
  totalClasses: number;
  totalSessions: number;
  totalStudentsEnrolled: number;
  atRiskCount: number;
}

interface ClassReport {
  class_id: string;
  class_name: string;
  course_code: string;
  department: string;
  semester: number | null;
  section: string | null;
  status: string;
  total_students: number;
  total_sessions: number;
  total_attendances: number;
  avg_percent: number;
}

interface StudentReport {
  student_id: string;
  student_code: string;
  student_name: string;
  email: string;
  class_id: string;
  class_name: string;
  course_code: string;
  department: string;
  semester: number | null;
  section: string | null;
  sessions: number;
  present: number;
  missed: number;
  percent: number;
  status_tier: 'good' | 'warning' | 'critical';
}

interface SessionLog {
  session_id: string;
  class_id: string;
  class_name: string;
  course_code: string;
  department: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  otp_period: number;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  percent: number;
}

export default function ReportsPage() {
  const [kpis, setKpis] = useState<KPIStats>({
    overallRate: 0,
    totalClasses: 0,
    totalSessions: 0,
    totalStudentsEnrolled: 0,
    atRiskCount: 0,
  });
  const [classReports, setClassReports] = useState<ClassReport[]>([]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableClasses, setAvailableClasses] = useState<Array<{ id: string; name: string; course_code: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports');
      const data = await res.json();
      if (data.kpis) setKpis(data.kpis);
      setClassReports(data.classReports ?? []);
      setStudentReports(data.studentReports ?? []);
      setSessionLogs(data.sessionLogs ?? []);
      if (data.filters?.departments) setAvailableDepartments(data.filters.departments);
      if (data.filters?.classes) setAvailableClasses(data.filters.classes);
    } catch (err) {
      message.error('Failed to load attendance report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Student Reports
  const filteredStudents = useMemo(() => {
    return studentReports.filter((s) => {
      if (selectedClass !== 'all' && s.class_id !== selectedClass) return false;
      if (selectedDept !== 'all' && s.department !== selectedDept) return false;
      if (selectedStatus !== 'all' && s.status_tier !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.student_name.toLowerCase().includes(q);
        const matchesCode = s.student_code.toLowerCase().includes(q);
        const matchesEmail = s.email.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesEmail) return false;
      }
      return true;
    });
  }, [studentReports, selectedClass, selectedDept, selectedStatus, searchQuery]);

  // Filtered Class Reports
  const filteredClasses = useMemo(() => {
    return classReports.filter((c) => {
      if (selectedClass !== 'all' && c.class_id !== selectedClass) return false;
      if (selectedDept !== 'all' && c.department !== selectedDept) return false;
      return true;
    });
  }, [classReports, selectedClass, selectedDept]);

  // Filtered Session Logs
  const filteredSessions = useMemo(() => {
    return sessionLogs.filter((s) => {
      if (selectedClass !== 'all' && s.class_id !== selectedClass) return false;
      if (selectedDept !== 'all' && s.department !== selectedDept) return false;
      return true;
    });
  }, [sessionLogs, selectedClass, selectedDept]);

  // CSV Export: Students
  const exportStudentsCSV = () => {
    if (filteredStudents.length === 0) {
      message.warning('No student attendance records to export');
      return;
    }

    const headers = [
      'Student ID',
      'Student Name',
      'Email',
      'Course Code',
      'Class Name',
      'Department',
      'Semester',
      'Section',
      'Total Sessions Held',
      'Sessions Attended',
      'Sessions Missed',
      'Attendance Percentage',
      'Status Tier',
    ];

    const rows = filteredStudents.map((s) => [
      `"${s.student_code}"`,
      `"${s.student_name.replace(/"/g, '""')}"`,
      `"${s.email}"`,
      `"${s.course_code}"`,
      `"${s.class_name.replace(/"/g, '""')}"`,
      `"${s.department}"`,
      s.semester ?? '',
      s.section ?? '',
      s.sessions,
      s.present,
      s.missed,
      `${s.percent}%`,
      s.status_tier.toUpperCase(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rollin_Student_Attendance_Report_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Student attendance report exported!');
  };

  // CSV Export: Classes
  const exportClassesCSV = () => {
    if (filteredClasses.length === 0) {
      message.warning('No class summary records to export');
      return;
    }

    const headers = [
      'Course Code',
      'Class Name',
      'Department',
      'Semester',
      'Section',
      'Enrolled Students',
      'Total Sessions',
      'Total Attendances',
      'Average Attendance Percentage',
    ];

    const rows = filteredClasses.map((c) => [
      `"${c.course_code}"`,
      `"${c.class_name.replace(/"/g, '""')}"`,
      `"${c.department}"`,
      c.semester ?? '',
      c.section ?? '',
      c.total_students,
      c.total_sessions,
      c.total_attendances,
      `${c.avg_percent}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rollin_Class_Attendance_Summary_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Class summary report exported!');
  };

  // Table Columns: Students
  const studentColumns: ColumnsType<StudentReport> = [
    {
      title: 'Student',
      key: 'student',
      render: (_, r) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{r.student_name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12 }}>{r.student_code}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>· {r.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Class / Course',
      key: 'class',
      render: (_, r) => (
        <div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{r.class_name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            <Tag color="geekblue" style={{ borderRadius: 4, fontSize: 11, margin: 0 }}>
              {r.course_code}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.department}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Attended / Sessions',
      key: 'counts',
      align: 'center',
      render: (_, r) => (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
            {r.present}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            {' '}/ {r.sessions}
          </span>
          {r.missed > 0 && (
            <div style={{ color: '#f87171', fontSize: 11, marginTop: 2 }}>
              {r.missed} missed
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Attendance Rate',
      dataIndex: 'percent',
      key: 'percent',
      sorter: (a, b) => a.percent - b.percent,
      render: (v: number, r) => {
        const color = v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 160 }}>
            <Progress
              percent={v}
              size="small"
              strokeColor={color}
              railColor="rgba(255,255,255,0.08)"
              showInfo={false}
              style={{ flex: 1 }}
            />
            <span style={{ color, fontWeight: 700, fontSize: 14, minWidth: 42, textAlign: 'right' }}>
              {v}%
            </span>
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center',
      render: (_, r) => {
        if (r.sessions === 0) {
          return <Tag style={{ borderRadius: 6 }}>No Sessions</Tag>;
        }
        if (r.status_tier === 'good') {
          return <Tag color="success" style={{ borderRadius: 6, fontWeight: 600 }}>Good</Tag>;
        }
        if (r.status_tier === 'warning') {
          return <Tag color="warning" style={{ borderRadius: 6, fontWeight: 600 }}>Warning</Tag>;
        }
        return <Tag color="error" style={{ borderRadius: 6, fontWeight: 600 }}>Critical (&lt;50%)</Tag>;
      },
    },
  ];

  // Table Columns: Classes
  const classColumns: ColumnsType<ClassReport> = [
    {
      title: 'Course / Class',
      key: 'class',
      render: (_, r) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{r.class_name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Tag color="purple" style={{ borderRadius: 4, fontSize: 11, margin: 0 }}>
              {r.course_code}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {[r.department, r.semester && `Sem ${r.semester}`, r.section && `Sec ${r.section}`]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Enrolled Students',
      dataIndex: 'total_students',
      align: 'center',
      render: (v: number) => <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{v}</span>,
    },
    {
      title: 'Sessions Held',
      dataIndex: 'total_sessions',
      align: 'center',
      render: (v: number) => <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{v}</span>,
    },
    {
      title: 'Total Check-Ins',
      dataIndex: 'total_attendances',
      align: 'center',
      render: (v: number) => <span style={{ color: '#818cf8', fontWeight: 600, fontSize: 14 }}>{v}</span>,
    },
    {
      title: 'Average Attendance',
      dataIndex: 'avg_percent',
      sorter: (a, b) => a.avg_percent - b.avg_percent,
      render: (v: number) => {
        const color = v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 160 }}>
            <Progress
              percent={v}
              size="small"
              strokeColor={color}
              railColor="rgba(255,255,255,0.08)"
              showInfo={false}
              style={{ flex: 1 }}
            />
            <span style={{ color, fontWeight: 700, fontSize: 14, minWidth: 42, textAlign: 'right' }}>
              {v}%
            </span>
          </div>
        );
      },
    },
  ];

  // Table Columns: Sessions Log
  const sessionColumns: ColumnsType<SessionLog> = [
    {
      title: 'Date & Time',
      key: 'date',
      render: (_, r) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>
            {dayjs(r.started_at).format('MMM D, YYYY')}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(r.started_at).format('h:mm A')}
            {r.ended_at && ` – ${dayjs(r.ended_at).format('h:mm A')}`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Class',
      key: 'class',
      render: (_, r) => (
        <div>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{r.class_name}</span>
          <Tag color="cyan" style={{ borderRadius: 4, fontSize: 11, marginLeft: 8 }}>
            {r.course_code}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Present / Enrolled',
      key: 'present',
      align: 'center',
      render: (_, r) => (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>{r.present_count}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}> / {r.total_enrolled}</span>
        </div>
      ),
    },
    {
      title: 'Turnout Rate',
      dataIndex: 'percent',
      sorter: (a, b) => a.percent - b.percent,
      render: (v: number) => {
        const color = v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
            <Progress
              percent={v}
              size="small"
              strokeColor={color}
              railColor="rgba(255,255,255,0.08)"
              showInfo={false}
              style={{ flex: 1 }}
            />
            <span style={{ color, fontWeight: 700, fontSize: 13, minWidth: 38 }}>{v}%</span>
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center',
      render: (_, r) => (
        <Tag color={r.status === 'open' ? 'processing' : 'default'} style={{ borderRadius: 6 }}>
          {r.status === 'open' ? 'Live Open' : 'Closed'}
        </Tag>
      ),
    },
  ];

  const statCardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: '100%',
  };

  return (
    <AntdConfigProvider>
      <div>
        {/* Header with Title & Export Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
              Attendance Reports
            </Title>
            <Text type="secondary">
              Comprehensive student attendance rates, course trends, and data export
            </Text>
          </div>

          <Space wrap size={10}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 10,
                height: 38,
              }}
            >
              Refresh
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={exportClassesCSV}
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 10,
                height: 38,
                fontWeight: 500,
              }}
            >
              Export Class Summary
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportStudentsCSV}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: 10,
                height: 38,
                fontWeight: 600,
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              }}
            >
              Export Student Report (CSV)
            </Button>
          </Space>
        </div>

        {loading ? (
          <StylishLoader
            message="Calculating attendance analytics..."
            submessage="Analyzing student check-ins, class rates, and risk factors"
          />
        ) : (
          <>
            {/* KPI Summary Metric Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card style={statCardStyle} styles={{ body: { padding: '20px 24px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Overall Attendance Rate
                      </Text>
                      <div style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: kpis.overallRate >= 75 ? '#34d399' : kpis.overallRate >= 50 ? '#fbbf24' : '#f87171',
                        marginTop: 4,
                      }}>
                        {kpis.overallRate}%
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#34d399',
                      fontSize: 22,
                    }}>
                      <BarChartOutlined />
                    </div>
                  </div>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card style={statCardStyle} styles={{ body: { padding: '20px 24px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Students Enrolled
                      </Text>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                        {kpis.totalStudentsEnrolled}
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: 'rgba(99, 102, 241, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#818cf8',
                      fontSize: 22,
                    }}>
                      <UserOutlined />
                    </div>
                  </div>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card style={statCardStyle} styles={{ body: { padding: '20px 24px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Sessions Conducted
                      </Text>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                        {kpis.totalSessions}
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: 'rgba(236, 72, 153, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f472b6',
                      fontSize: 22,
                    }}>
                      <ClockCircleOutlined />
                    </div>
                  </div>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card style={statCardStyle} styles={{ body: { padding: '20px 24px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Students at Risk (&lt;75%)
                      </Text>
                      <div style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: kpis.atRiskCount > 0 ? '#f87171' : '#34d399',
                        marginTop: 4,
                      }}>
                        {kpis.atRiskCount}
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: 'rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f87171',
                      fontSize: 22,
                    }}>
                      <AlertOutlined />
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* Interactive Filters Bar */}
            <Card
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                marginBottom: 20,
              }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <Row gutter={[16, 12]} align="middle">
                <Col xs={24} sm={12} md={6}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Filter by Course
                  </Text>
                  <Select
                    value={selectedClass}
                    onChange={setSelectedClass}
                    style={{ width: '100%' }}
                    placeholder="All Classes"
                  >
                    <Option value="all">All Classes ({availableClasses.length})</Option>
                    {availableClasses.map((c) => (
                      <Option key={c.id} value={c.id}>
                        {c.course_code} — {c.name}
                      </Option>
                    ))}
                  </Select>
                </Col>

                <Col xs={24} sm={12} md={5}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Filter by Department
                  </Text>
                  <Select
                    value={selectedDept}
                    onChange={setSelectedDept}
                    style={{ width: '100%' }}
                    placeholder="All Departments"
                  >
                    <Option value="all">All Departments</Option>
                    {availableDepartments.map((d) => (
                      <Option key={d} value={d}>{d}</Option>
                    ))}
                  </Select>
                </Col>

                <Col xs={24} sm={12} md={5}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Attendance Status
                  </Text>
                  <Select
                    value={selectedStatus}
                    onChange={setSelectedStatus}
                    style={{ width: '100%' }}
                  >
                    <Option value="all">All Statuses</Option>
                    <Option value="good">Good (≥75%)</Option>
                    <Option value="warning">Warning (50–74%)</Option>
                    <Option value="critical">Critical (&lt;50%)</Option>
                  </Select>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Search Student
                  </Text>
                  <Input
                    prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                    placeholder="Search by student name or ID…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    allowClear
                  />
                </Col>
              </Row>
            </Card>

            {/* Reports Tabs */}
            <Card
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
              }}
              styles={{ body: { padding: 0 } }}
            >
              <Tabs
                defaultActiveKey="students"
                style={{ padding: '0 16px' }}
                items={[
                  {
                    key: 'students',
                    label: `Student Roster Analytics (${filteredStudents.length})`,
                    children: (
                      <Table
                        dataSource={filteredStudents}
                        columns={studentColumns}
                        rowKey={(r) => `${r.student_id}-${r.class_id}`}
                        pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50'] }}
                        locale={{ emptyText: <Empty description="No student records match the selected filters" /> }}
                        style={{ padding: '0 0 16px' }}
                      />
                    ),
                  },
                  {
                    key: 'classes',
                    label: `Class Summaries (${filteredClasses.length})`,
                    children: (
                      <Table
                        dataSource={filteredClasses}
                        columns={classColumns}
                        rowKey="class_id"
                        pagination={{ pageSize: 15, showSizeChanger: false }}
                        locale={{ emptyText: <Empty description="No class data available" /> }}
                        style={{ padding: '0 0 16px' }}
                      />
                    ),
                  },
                  {
                    key: 'sessions',
                    label: `Session History Logs (${filteredSessions.length})`,
                    children: (
                      <Table
                        dataSource={filteredSessions}
                        columns={sessionColumns}
                        rowKey="session_id"
                        pagination={{ pageSize: 15, showSizeChanger: false }}
                        locale={{ emptyText: <Empty description="No attendance sessions recorded yet" /> }}
                        style={{ padding: '0 0 16px' }}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          </>
        )}
      </div>
    </AntdConfigProvider>
  );
}

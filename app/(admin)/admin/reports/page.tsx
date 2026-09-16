'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Typography, Progress, Tag, Select, Tabs, Input, Button,
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
import SharedTable from '@/components/SharedTable';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

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

  // XLSX Export: Students
  const exportStudentsXLSX = () => {
    if (filteredStudents.length === 0) {
      message.warning('No student attendance records to export');
      return;
    }

    const data = filteredStudents.map((s) => ({
      'Student ID': s.student_code,
      'Student Name': s.student_name,
      'Email': s.email,
      'Course Code': s.course_code,
      'Class Name': s.class_name,
      'Department': s.department,
      'Semester': s.semester ?? '',
      'Section': s.section ?? '',
      'Total Sessions Held': s.sessions,
      'Sessions Attended': s.present,
      'Sessions Missed': s.missed,
      'Attendance Percentage': `${s.percent}%`,
      'Status Tier': s.status_tier.toUpperCase(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Attendance');
    XLSX.writeFile(workbook, `Rollin_Student_Attendance_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Student attendance report exported (.xlsx)!');
  };

  // XLSX Export: Classes
  const exportClassesXLSX = () => {
    if (filteredClasses.length === 0) {
      message.warning('No class summary records to export');
      return;
    }

    const data = filteredClasses.map((c) => ({
      'Course Code': c.course_code,
      'Class Name': c.class_name,
      'Department': c.department,
      'Semester': c.semester ?? '',
      'Section': c.section ?? '',
      'Enrolled Students': c.total_students,
      'Total Sessions': c.total_sessions,
      'Total Attendances': c.total_attendances,
      'Average Attendance Percentage': `${c.avg_percent}%`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Class Summaries');
    XLSX.writeFile(workbook, `Rollin_Class_Attendance_Summary_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Class summary report exported (.xlsx)!');
  };

  // State for tracking single session export in progress
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);

  // XLSX Export: All Sessions Summary
  const exportSessionsSummaryXLSX = () => {
    if (filteredSessions.length === 0) {
      message.warning('No session history records to export');
      return;
    }

    const data = filteredSessions.map((s) => ({
      'Session ID': s.session_id,
      'Course Code': s.course_code,
      'Class Name': s.class_name,
      'Department': s.department,
      'Session Date': dayjs(s.started_at).format('YYYY-MM-DD'),
      'Start Time': dayjs(s.started_at).format('hh:mm A'),
      'End Time': s.ended_at ? dayjs(s.ended_at).format('hh:mm A') : 'Live Open',
      'Status': s.status === 'open' ? 'Live Open' : 'Closed',
      'Total Enrolled': s.total_enrolled,
      'Present Count': s.present_count,
      'Absent Count': s.absent_count,
      'Turnout Rate': `${s.percent}%`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Session History');
    XLSX.writeFile(workbook, `Rollin_Session_Attendance_Summary_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Session summary report exported (.xlsx)!');
  };

  // XLSX Export: Single Session with Detailed Attendee Roster
  const exportSingleSessionXLSX = async (session: SessionLog) => {
    setExportingSessionId(session.session_id);
    try {
      const res = await fetch(`/api/admin/sessions/${session.session_id}`);
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || 'Failed to fetch session attendee data');
        return;
      }

      const attendanceMap = new Map<string, any>();
      (data.attendance || []).forEach((a: any) => {
        attendanceMap.set(a.student_id, a);
      });

      // Build roster: enrolled students + any other attendee
      const rosterList: any[] = [];
      const enrolled: any[] = data.enrolledStudents || [];
      const seenStudents = new Set<string>();

      enrolled.forEach((item: any) => {
        const student = item.student;
        if (!student) return;
        seenStudents.add(student.id);
        const record = attendanceMap.get(student.id);
        rosterList.push({
          'Student Code': student.student_code,
          'Student Name': student.name,
          'Email': student.email,
          'Department': student.department || session.department,
          'Semester': student.semester ?? '',
          'Section': student.section ?? '',
          'Attendance Status': record ? 'PRESENT' : 'ABSENT',
          'Check-in Time': record ? dayjs(record.marked_at).format('hh:mm:ss A') : '—',
          'Verified IP': record?.ip_address || '—',
        });
      });

      // Include any attendee that wasn't in the enrolled list
      (data.attendance || []).forEach((a: any) => {
        if (!seenStudents.has(a.student_id) && a.student) {
          rosterList.push({
            'Student Code': a.student.student_code,
            'Student Name': a.student.name,
            'Email': a.student.email,
            'Department': a.student.department || session.department,
            'Semester': a.student.semester ?? '',
            'Section': a.student.section ?? '',
            'Attendance Status': 'PRESENT',
            'Check-in Time': dayjs(a.marked_at).format('hh:mm:ss A'),
            'Verified IP': a.ip_address || '—',
          });
        }
      });

      // Fallback if no enrolled list in DB
      if (rosterList.length === 0 && (data.attendance || []).length > 0) {
        (data.attendance || []).forEach((a: any) => {
          rosterList.push({
            'Student Code': a.student?.student_code || '—',
            'Student Name': a.student?.name || '—',
            'Email': a.student?.email || '—',
            'Department': a.student?.department || session.department,
            'Semester': a.student?.semester ?? '',
            'Section': a.student?.section ?? '',
            'Attendance Status': 'PRESENT',
            'Check-in Time': dayjs(a.marked_at).format('hh:mm:ss A'),
            'Verified IP': a.ip_address || '—',
          });
        });
      }

      if (rosterList.length === 0) {
        message.warning('No student records found for this session');
        return;
      }

      // Metadata summary sheet
      const sessionSummaryData = [
        { Parameter: 'Course Code', Value: session.course_code },
        { Parameter: 'Class Name', Value: session.class_name },
        { Parameter: 'Department', Value: session.department },
        { Parameter: 'Session Date', Value: dayjs(session.started_at).format('YYYY-MM-DD') },
        { Parameter: 'Started At', Value: dayjs(session.started_at).format('hh:mm:ss A') },
        { Parameter: 'Ended At', Value: session.ended_at ? dayjs(session.ended_at).format('hh:mm:ss A') : 'Live / Active' },
        { Parameter: 'Status', Value: session.status.toUpperCase() },
        { Parameter: 'Total Enrolled', Value: session.total_enrolled },
        { Parameter: 'Total Present', Value: session.present_count },
        { Parameter: 'Total Absent', Value: session.absent_count },
        { Parameter: 'Turnout Rate', Value: `${session.percent}%` },
      ];

      const workbook = XLSX.utils.book_new();
      const wsRoster = XLSX.utils.json_to_sheet(rosterList);
      const wsSummary = XLSX.utils.json_to_sheet(sessionSummaryData);

      XLSX.utils.book_append_sheet(workbook, wsRoster, 'Attendance Roster');
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Session Overview');

      const fileName = `Session_${session.course_code}_${dayjs(session.started_at).format('YYYY-MM-DD_HHmm')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      message.success(`Exported ${session.course_code} session report (.xlsx)!`);
    } catch (err) {
      message.error('Failed to export session report');
    } finally {
      setExportingSessionId(null);
    }
  };

  // Table Columns: Students
  const studentColumns: ColumnsType<StudentReport> = [
    {
      title: 'Student',
      key: 'student',
      width: 220,
      render: (_, r) => (
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ color: '#111111', fontWeight: 600, fontSize: 12.5, lineHeight: 1.2 }}>{r.student_name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
            <span style={{ color: '#2563EB', fontFamily: 'monospace', fontSize: 11 }}>{r.student_code}</span>
            <span style={{ color: '#6B6B6B', fontSize: 11 }}>· {r.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Class / Course',
      key: 'class',
      width: 200,
      render: (_, r) => (
        <div style={{ lineHeight: 1.15 }}>
          <span style={{ color: '#111111', fontWeight: 500, fontSize: 12.5 }}>{r.class_name}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
            <Tag color="geekblue" style={{ borderRadius: 0, fontSize: 10, margin: 0, padding: '0 4px', height: 18, lineHeight: '16px' }}>
              {r.course_code}
            </Tag>
            <span style={{ color: '#6B6B6B', fontSize: 11 }}>{r.department}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Attended / Sessions',
      key: 'counts',
      align: 'center',
      width: 140,
      render: (_, r) => (
        <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
          <span style={{ color: '#111111', fontWeight: 700, fontSize: 13 }}>
            {r.present}
          </span>
          <span style={{ color: '#6B6B6B', fontSize: 12 }}>
            {' '}/ {r.sessions}
          </span>
          {r.missed > 0 && (
            <div style={{ color: '#DC2626', fontSize: 10.5 }}>
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
      width: 170,
      sorter: (a, b) => a.percent - b.percent,
      render: (v: number) => {
        const color = v >= 75 ? '#16A34A' : v >= 50 ? '#D97706' : '#DC2626';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
            <Progress
              percent={v}
              size="small"
              strokeColor={color}
              railColor="#E4E4E4"
              showInfo={false}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <span style={{ color, fontWeight: 700, fontSize: 12.5, minWidth: 36, textAlign: 'right' }}>
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
      width: 100,
      render: (_, r) => {
        if (r.sessions === 0) {
          return <Tag style={{ borderRadius: 0, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px' }}>No Sessions</Tag>;
        }
        if (r.status_tier === 'good') {
          return <Tag color="success" style={{ borderRadius: 0, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px', fontWeight: 600 }}>Good</Tag>;
        }
        if (r.status_tier === 'warning') {
          return <Tag color="warning" style={{ borderRadius: 0, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px', fontWeight: 600 }}>Warning</Tag>;
        }
        return <Tag color="error" style={{ borderRadius: 0, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px', fontWeight: 600 }}>Critical (&lt;50%)</Tag>;
      },
    },
  ];

  // Table Columns: Classes
  const classColumns: ColumnsType<ClassReport> = [
    {
      title: 'Course / Class',
      key: 'class',
      width: 250,
      render: (_, r) => (
        <div>
          <div style={{ color: '#111111', fontWeight: 600, fontSize: 14 }}>{r.class_name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Tag color="purple" style={{ borderRadius: 0, fontSize: 11, margin: 0 }}>
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
      width: 140,
      render: (v: number) => <span style={{ color: '#111111', fontWeight: 600, fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Sessions Held',
      dataIndex: 'total_sessions',
      align: 'center',
      width: 130,
      render: (v: number) => <span style={{ color: '#111111', fontWeight: 600, fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Total Check-Ins',
      dataIndex: 'total_attendances',
      align: 'center',
      width: 140,
      render: (v: number) => <span style={{ color: '#2563EB', fontWeight: 600, fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Average Attendance',
      dataIndex: 'avg_percent',
      width: 180,
      sorter: (a, b) => a.avg_percent - b.avg_percent,
      render: (v: number) => {
        const color = v >= 75 ? '#16A34A' : v >= 50 ? '#D97706' : '#DC2626';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 150 }}>
            <Progress
              percent={v}
              size="small"
              strokeColor={color}
              railColor="#E4E4E4"
              showInfo={false}
              style={{ flex: 1 }}
            />
            <span style={{ color, fontWeight: 700, fontSize: 13, minWidth: 40, textAlign: 'right' }}>
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
      width: 180,
      render: (_, r) => (
        <div>
          <div style={{ color: '#111111', fontWeight: 600 }}>
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
      width: 220,
      render: (_, r) => (
        <div>
          <span style={{ color: '#111111', fontWeight: 500 }}>{r.class_name}</span>
          <Tag color="cyan" style={{ borderRadius: 0, fontSize: 11, marginLeft: 8 }}>
            {r.course_code}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Present / Enrolled',
      key: 'present',
      align: 'center',
      width: 160,
      render: (_, r) => (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 14 }}>{r.present_count}</span>
          <span style={{ color: '#6B6B6B' }}> / {r.total_enrolled}</span>
        </div>
      ),
    },
    {
      title: 'Turnout Rate',
      dataIndex: 'percent',
      width: 170,
      sorter: (a, b) => a.percent - b.percent,
      render: (v: number) => {
        const color = v >= 75 ? '#16A34A' : v >= 50 ? '#D97706' : '#DC2626';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
            <Progress
              percent={v}
              size="small"
              strokeColor={color}
              railColor="#E4E4E4"
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
      width: 110,
      render: (_, r) => (
        <Tag color={r.status === 'open' ? 'processing' : 'default'} style={{ borderRadius: 0 }}>
          {r.status === 'open' ? 'Live Open' : 'Closed'}
        </Tag>
      ),
    },
    {
      title: 'Export',
      key: 'action',
      align: 'center',
      width: 120,
      fixed: 'right' as const,
      render: (_, r) => (
        <Button
          size="small"
          icon={<FileExcelOutlined />}
          loading={exportingSessionId === r.session_id}
          onClick={() => exportSingleSessionXLSX(r)}
          style={{
            background: '#EFF6FF',
            borderColor: '#BFDBFE',
            color: '#2563EB',
            borderRadius: 0,
            fontWeight: 500,
          }}
        >
          Export XLSX
        </Button>
      ),
    },
  ];

  const statCardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E4E4E4',
    borderRadius: 0,
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
            <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>
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
                background: '#FFFFFF',
                borderColor: '#E4E4E4',
                color: '#111111',
                borderRadius: 0,
                height: 36,
              }}
            >
              Refresh
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={exportClassesXLSX}
              style={{
                background: '#FFFFFF',
                borderColor: '#E4E4E4',
                color: '#111111',
                borderRadius: 0,
                height: 36,
                fontWeight: 500,
              }}
            >
              Export Class Summary (XLSX)
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={exportSessionsSummaryXLSX}
              style={{
                background: '#FFFFFF',
                borderColor: '#E4E4E4',
                color: '#111111',
                borderRadius: 0,
                height: 36,
                fontWeight: 500,
              }}
            >
              Export Sessions (XLSX)
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportStudentsXLSX}
              style={{
                background: '#2563EB',
                borderColor: '#2563EB',
                color: '#FFFFFF',
                borderRadius: 0,
                height: 36,
                fontWeight: 600,
              }}
            >
              Export Student Report (XLSX)
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
                        color: kpis.overallRate >= 75 ? '#16A34A' : kpis.overallRate >= 50 ? '#D97706' : '#DC2626',
                        marginTop: 4,
                      }}>
                        {kpis.overallRate}%
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 0,
                      background: '#F0FDF4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#16A34A',
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
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', marginTop: 4 }}>
                        {kpis.totalStudentsEnrolled}
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 0,
                      background: '#EFF6FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563EB',
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
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', marginTop: 4 }}>
                        {kpis.totalSessions}
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 0,
                      background: '#FDF2F8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#DB2777',
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
                        color: kpis.atRiskCount > 0 ? '#DC2626' : '#16A34A',
                        marginTop: 4,
                      }}>
                        {kpis.atRiskCount}
                      </div>
                    </div>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: 0,
                      background: '#FEF2F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#DC2626',
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
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                borderRadius: 0,
                marginBottom: 20,
              }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <Row gutter={[16, 12]} align="middle">
                <Col xs={24} sm={12} md={6}>
                  <Text style={{ color: '#6B6B6B', fontSize: 12, display: 'block', marginBottom: 4 }}>
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
                  <Text style={{ color: '#6B6B6B', fontSize: 12, display: 'block', marginBottom: 4 }}>
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
                  <Text style={{ color: '#6B6B6B', fontSize: 12, display: 'block', marginBottom: 4 }}>
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
                  <Text style={{ color: '#6B6B6B', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Search Student
                  </Text>
                  <Input
                    prefix={<SearchOutlined style={{ color: '#6B6B6B' }} />}
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
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                borderRadius: 0,
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
                      <SharedTable
                        dataSource={filteredStudents}
                        columns={studentColumns}
                        rowKey={(r) => `${r.student_id}-${r.class_id}`}
                        scroll={{ x: 860 }}
                        pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50'] }}
                        locale={{ emptyText: <Empty description="No student records match the selected filters" /> }}
                      />
                    ),
                  },
                  {
                    key: 'classes',
                    label: `Class Summaries (${filteredClasses.length})`,
                    children: (
                      <SharedTable
                        dataSource={filteredClasses}
                        columns={classColumns}
                        rowKey="class_id"
                        scroll={{ x: 820 }}
                        pagination={{ pageSize: 15, showSizeChanger: false }}
                        locale={{ emptyText: <Empty description="No class data available" /> }}
                      />
                    ),
                  },
                  {
                    key: 'sessions',
                    label: `Session History Logs (${filteredSessions.length})`,
                    children: (
                      <div style={{ padding: '0 0 8px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 16px',
                          borderBottom: '1px solid #E4E4E4',
                          marginBottom: 10,
                          flexWrap: 'wrap',
                          gap: 10,
                        }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {filteredSessions.length} session records found — click <strong style={{ color: '#2563EB' }}>Export XLSX</strong> on any row to download full student attendee rosters
                          </Text>
                          <Button
                            size="small"
                            icon={<FileExcelOutlined />}
                            onClick={exportSessionsSummaryXLSX}
                            style={{
                              background: '#FFFFFF',
                              borderColor: '#E4E4E4',
                              color: '#111111',
                              borderRadius: 0,
                              height: 28,
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            Export All Sessions (XLSX)
                          </Button>
                        </div>
                        <SharedTable
                          dataSource={filteredSessions}
                          columns={sessionColumns}
                          rowKey="session_id"
                          scroll={{ x: 920 }}
                          pagination={{ pageSize: 15, showSizeChanger: false }}
                          locale={{ emptyText: <Empty description="No attendance sessions recorded yet" /> }}
                        />
                      </div>
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

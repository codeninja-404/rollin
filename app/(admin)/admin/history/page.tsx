'use client';

import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Tag, Space,
  Button, Drawer, List, Avatar,
} from 'antd';
import { EyeOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { AttendanceSession, Attendance } from '@/lib/types';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { message } from 'antd';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import SharedTable from '@/components/SharedTable';

const { Title, Text } = Typography;

export default function HistoryPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AttendanceSession | null>(null);
  const [sessionAttendance, setSessionAttendance] = useState<Attendance[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/sessions?status=closed');
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const viewSession = async (session: AttendanceSession) => {
    setSelected(session);
    setDrawerOpen(true);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`);
      const data = await res.json();
      setSessionAttendance(data.attendance ?? []);
    } finally {
      setLoadingDetail(false);
    }
  };

  const exportSessionXLSX = async (session: AttendanceSession, preloadedAttendance?: Attendance[]) => {
    setExportingId(session.id);
    try {
      let attendanceList = preloadedAttendance;
      let enrolledList: any[] = [];
      if (!attendanceList) {
        const res = await fetch(`/api/admin/sessions/${session.id}`);
        const data = await res.json();
        attendanceList = data.attendance ?? [];
        enrolledList = data.enrolledStudents ?? [];
      }

      const attendanceMap = new Map<string, any>();
      (attendanceList || []).forEach((a: any) => {
        attendanceMap.set(a.student_id, a);
      });

      const rosterList: any[] = [];
      const seenStudents = new Set<string>();

      enrolledList.forEach((item: any) => {
        const student = item.student;
        if (!student) return;
        seenStudents.add(student.id);
        const record = attendanceMap.get(student.id);
        rosterList.push({
          'Student Code': student.student_code,
          'Student Name': student.name,
          'Email': student.email,
          'Department': student.department || (session.class as any)?.department || '—',
          'Semester': student.semester ?? '',
          'Section': student.section ?? '',
          'Attendance Status': record ? 'PRESENT' : 'ABSENT',
          'Check-in Time': record ? dayjs(record.marked_at).format('hh:mm:ss A') : '—',
          'Verified IP': record?.ip_address || '—',
        });
      });

      (attendanceList || []).forEach((a: any) => {
        if (!seenStudents.has(a.student_id) && a.student) {
          rosterList.push({
            'Student Code': a.student.student_code,
            'Student Name': a.student.name,
            'Email': a.student.email,
            'Department': a.student.department || (session.class as any)?.department || '—',
            'Semester': a.student.semester ?? '',
            'Section': a.student.section ?? '',
            'Attendance Status': 'PRESENT',
            'Check-in Time': dayjs(a.marked_at).format('hh:mm:ss A'),
            'Verified IP': a.ip_address || '—',
          });
        }
      });

      if (rosterList.length === 0 && (attendanceList || []).length > 0) {
        (attendanceList || []).forEach((a: any) => {
          rosterList.push({
            'Student Code': (a.student as any)?.student_code || '—',
            'Student Name': (a.student as any)?.name || '—',
            'Email': (a.student as any)?.email || '—',
            'Department': (a.student as any)?.department || '—',
            'Attendance Status': 'PRESENT',
            'Check-in Time': dayjs(a.marked_at).format('hh:mm:ss A'),
            'Verified IP': a.ip_address || '—',
          });
        });
      }

      if (rosterList.length === 0) {
        message.warning('No attendee records found for this session');
        return;
      }

      const sessionOverview = [
        { Parameter: 'Course Code', Value: (session.class as any)?.course_code || '—' },
        { Parameter: 'Class Name', Value: (session.class as any)?.name || '—' },
        { Parameter: 'Date', Value: dayjs(session.started_at).format('YYYY-MM-DD') },
        { Parameter: 'Started At', Value: dayjs(session.started_at).format('hh:mm:ss A') },
        { Parameter: 'Ended At', Value: session.ended_at ? dayjs(session.ended_at).format('hh:mm:ss A') : '—' },
        { Parameter: 'Total Present', Value: (attendanceList || []).length },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rosterList), 'Attendance Roster');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessionOverview), 'Overview');

      const fileName = `Session_${(session.class as any)?.course_code || 'Class'}_${dayjs(session.started_at).format('YYYY-MM-DD_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      message.success('Session report exported (.xlsx)!');
    } catch {
      message.error('Failed to export session report');
    } finally {
      setExportingId(null);
    }
  };

  const exportAllSessionsXLSX = () => {
    if (sessions.length === 0) {
      message.warning('No sessions available to export');
      return;
    }

    const data = sessions.map((s) => ({
      'Session ID': s.id,
      'Course Code': (s.class as any)?.course_code || '—',
      'Class Name': (s.class as any)?.name || '—',
      'Date': dayjs(s.started_at).format('YYYY-MM-DD'),
      'Started At': dayjs(s.started_at).format('hh:mm A'),
      'Ended At': s.ended_at ? dayjs(s.ended_at).format('hh:mm A') : 'Live',
      'Status': s.status.toUpperCase(),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'All Sessions');
    XLSX.writeFile(wb, `Rollin_Past_Sessions_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('All sessions exported (.xlsx)!');
  };

  const columns = [
    {
      title: 'Class',
      key: 'class',
      width: 220,
      render: (_: any, s: AttendanceSession) => (
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ color: '#111111', fontWeight: 600, fontSize: 13 }}>{(s.class as any)?.name}</div>
          <span style={{ color: '#6B6B6B', fontSize: 11 }}>{(s.class as any)?.course_code}</span>
        </div>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'started_at',
      width: 200,
      render: (v: string) => <span style={{ color: '#111111', fontSize: 12 }}>{dayjs(v).format('MMM D, YYYY h:mm A')}</span>,
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 120,
      render: (_: any, s: AttendanceSession) => {
        if (!s.ended_at) return <span style={{ color: '#6B6B6B', fontSize: 12 }}>—</span>;
        const mins = dayjs(s.ended_at).diff(dayjs(s.started_at), 'minute');
        return <span style={{ color: '#6B6B6B', fontSize: 12 }}>{mins} min</span>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      align: 'center' as const,
      width: 100,
      render: (status: string) => (
        <Tag
          color={status === 'open' ? 'success' : 'default'}
          style={{ borderRadius: 0, fontSize: 10.5, margin: 0, padding: '0 6px', height: 20, lineHeight: '18px', fontWeight: 600 }}
        >
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 140,
      fixed: 'right' as const,
      render: (_: any, s: AttendanceSession) => (
        <Space size={6}>
          <Button
            type="default"
            icon={<EyeOutlined />}
            size="small"
            style={{ height: 24, fontSize: 11.5, padding: '0 8px', borderRadius: 0, borderColor: '#E4E4E4', color: '#2563EB' }}
            onClick={() => viewSession(s)}
          >
            View
          </Button>
          <Button
            type="default"
            icon={<FileExcelOutlined />}
            size="small"
            loading={exportingId === s.id}
            style={{ height: 24, fontSize: 11.5, padding: '0 8px', borderRadius: 0, borderColor: '#E4E4E4', color: '#16A34A' }}
            onClick={() => exportSessionXLSX(s)}
          >
            XLSX
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>
              Attendance History
            </Title>
            <Text type="secondary" style={{ color: '#6B6B6B' }}>Past sessions and attendance records</Text>
          </div>
          <Button
            icon={<FileExcelOutlined />}
            onClick={exportAllSessionsXLSX}
            style={{
              background: '#FFFFFF',
              borderColor: '#E4E4E4',
              color: '#111111',
              borderRadius: 0,
              height: 36,
              fontWeight: 500,
            }}
          >
            Export All (XLSX)
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
            dataSource={sessions}
            columns={columns}
            rowKey="id"
            loading={loading}
            scroll={{ x: 780 }}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: 'No closed sessions yet' }}
          />
        </Card>

        {/* Session detail drawer */}
        <Drawer
          title={
            selected ? (
              <div>
                <div style={{ color: '#111111', fontWeight: 700 }}>{(selected.class as any)?.name}</div>
                <Text type="secondary" style={{ fontSize: 12, color: '#6B6B6B' }}>
                  {dayjs(selected.started_at).format('MMMM D, YYYY h:mm A')}
                </Text>
              </div>
            ) : null
          }
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={400}
          styles={{
            body: { padding: 20, background: '#FFFFFF' },
            header: { background: '#FFFFFF', borderBottom: '1px solid #E4E4E4' },
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text type="secondary" style={{ color: '#6B6B6B' }}>
              {sessionAttendance.length} students attended
            </Text>
            {selected && (
              <Button
                type="primary"
                size="small"
                icon={<FileExcelOutlined />}
                loading={exportingId === selected.id}
                onClick={() => exportSessionXLSX(selected, sessionAttendance)}
                style={{
                  background: '#2563EB',
                  borderColor: '#2563EB',
                  borderRadius: 0,
                  fontWeight: 500,
                }}
              >
                Export XLSX
              </Button>
            )}
          </div>
          <List
            loading={loadingDetail}
            dataSource={sessionAttendance}
            renderItem={(a) => (
              <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #E4E4E4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <Avatar size={30} style={{ background: '#2563EB', color: '#FFFFFF', borderRadius: 0, fontWeight: 600 }}>
                    {(a.student as any)?.name?.charAt(0)}
                  </Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#111111', fontWeight: 600, fontSize: 13 }}>{(a.student as any)?.name}</div>
                    <Text type="secondary" style={{ fontSize: 11, color: '#6B6B6B' }}>{(a.student as any)?.student_code}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11, color: '#6B6B6B' }}>
                    {dayjs(a.marked_at).format('h:mm:ss A')}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        </Drawer>
      </div>
    </AntdConfigProvider>
  );
}

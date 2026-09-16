'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Button, Typography, Tag, Badge, Space,
  Modal, message, Spin, Empty,
} from 'antd';
import {
  BookOutlined, PlayCircleOutlined, ClockCircleOutlined,
  EyeOutlined, TeamOutlined,
} from '@ant-design/icons';
import type { Class, AttendanceSession } from '@/lib/types';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Title, Text } = Typography;

export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [openSessions, setOpenSessions] = useState<Record<string, AttendanceSession>>({});
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, sessionRes] = await Promise.all([
        fetch('/api/admin/classes'),
        fetch('/api/admin/sessions?status=open'),
      ]);
      const classData = await classRes.json();
      const sessionData = await sessionRes.json();

      setClasses(classData.classes ?? []);

      const map: Record<string, AttendanceSession> = {};
      (sessionData.sessions ?? []).forEach((s: AttendanceSession) => {
        map[s.class_id] = s;
      });
      setOpenSessions(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAttendance = async (classId: string, className: string) => {
    Modal.confirm({
      title: `Open Attendance for ${className}?`,
      content: 'This will create an attendance session and start generating OTPs.',
      okText: 'Open Attendance',
      cancelText: 'Cancel',
      onOk: async () => {
        setOpening(classId);
        try {
          const res = await fetch('/api/admin/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ class_id: classId }),
          });
          const data = await res.json();
          if (res.ok) {
            message.success('Attendance session opened!');
            router.push(`/admin/attendance/sessions/${data.session.id}`);
          } else {
            message.error(data.error ?? 'Failed to open attendance');
          }
        } finally {
          setOpening(null);
        }
      },
    });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const activeClasses = classes.filter((c) => c.status === 'active');

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ marginBottom: 28 }}>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
            Open Attendance
          </Title>
          <Text type="secondary">
            Select a class to start an attendance session
          </Text>
        </div>

        {/* Open sessions banner */}
        {Object.keys(openSessions).length > 0 && (
          <Card
            style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 14,
              marginBottom: 24,
            }}
            styles={{ body: { padding: '14px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge status="processing" color="#10b981" />
              <Text style={{ color: '#34d399', fontWeight: 600 }}>
                {Object.keys(openSessions).length} session(s) currently open
              </Text>
            </div>
          </Card>
        )}

        {activeClasses.length === 0 ? (
          <Empty description="No active classes. Create a class first." />
        ) : (
          <Row gutter={[20, 20]}>
            {activeClasses.map((cls) => {
              const session = openSessions[cls.id];
              const isOpen = !!session;

              return (
                <Col xs={24} sm={12} lg={8} key={cls.id}>
                  <Card
                    style={{
                      background: isOpen
                        ? 'rgba(16,185,129,0.08)'
                        : 'rgba(255,255,255,0.04)',
                      border: isOpen
                        ? '1px solid rgba(16,185,129,0.3)'
                        : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16,
                      height: '100%',
                      transition: 'all 0.2s',
                    }}
                    styles={{ body: { padding: 24 } }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isOpen ? '#34d399' : '#818cf8',
                        fontSize: 20,
                        flexShrink: 0,
                      }}>
                        <BookOutlined />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{cls.name}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{cls.course_code}</Text>
                        {[cls.department, cls.semester && `Sem ${cls.semester}`, cls.section && `Sec ${cls.section}`]
                          .filter(Boolean).length > 0 && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {[cls.department, cls.semester && `Sem ${cls.semester}`, cls.section && `Sec ${cls.section}`]
                                .filter(Boolean).join(' · ')}
                            </Text>
                          </div>
                        )}
                      </div>
                    </div>

                    {isOpen ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <Badge status="processing" color="#10b981" />
                          <Text style={{ color: '#34d399', fontWeight: 600 }}>
                            Attendance Open
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            · {dayjs(session.started_at).format('h:mm A')}
                          </Text>
                        </div>
                        <Button
                          type="primary"
                          icon={<EyeOutlined />}
                          block
                          onClick={() => router.push(`/admin/attendance/sessions/${session.id}`)}
                          style={{
                            background: 'linear-gradient(135deg,#10b981,#059669)',
                            border: 'none',
                            borderRadius: 10,
                            height: 40,
                            fontWeight: 600,
                          }}
                        >
                          View Live Session
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        block
                        loading={opening === cls.id}
                        onClick={() => openAttendance(cls.id, cls.name)}
                        style={{
                          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                          border: 'none',
                          borderRadius: 10,
                          height: 40,
                          fontWeight: 600,
                        }}
                      >
                        Open Attendance
                      </Button>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </div>
    </AntdConfigProvider>
  );
}

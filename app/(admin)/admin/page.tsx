'use client';

import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Table, Tag, Spin, Badge } from 'antd';
import {
  TeamOutlined,
  BookOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AntdConfigProvider from '@/components/AntdConfigProvider';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  openSessions: number;
  todayAttendance: number;
}

const statCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  overflow: 'hidden',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/dashboard');
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentSessions(data.recentSessions ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    {
      title: 'Total Students',
      value: stats?.totalStudents ?? 0,
      icon: <TeamOutlined />,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.15)',
    },
    {
      title: 'Total Classes',
      value: stats?.totalClasses ?? 0,
      icon: <BookOutlined />,
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.15)',
    },
    {
      title: 'Open Sessions',
      value: stats?.openSessions ?? 0,
      icon: <ClockCircleOutlined />,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.15)',
    },
    {
      title: "Today's Attendance",
      value: stats?.todayAttendance ?? 0,
      icon: <CheckCircleOutlined />,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.15)',
    },
  ];

  const columns = [
    {
      title: 'Class',
      dataIndex: ['class', 'name'],
      key: 'class',
      render: (name: string, row: any) => (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.class?.course_code}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={status === 'open' ? 'processing' : 'default'}
          text={
            <Tag
              color={status === 'open' ? 'green' : 'default'}
              style={{ borderRadius: 6 }}
            >
              {status === 'open' ? 'OPEN' : 'CLOSED'}
            </Tag>
          }
        />
      ),
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (val: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {dayjs(val).format('MMM D, h:mm A')}
        </Text>
      ),
    },
  ];

  return (
    <AntdConfigProvider>
      <div>
        <div style={{ marginBottom: 28 }}>
          <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
            Dashboard
          </Title>
          <Text type="secondary">
            Welcome back! Here&apos;s what&apos;s happening today.
          </Text>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
              {statCards.map((card) => (
                <Col xs={24} sm={12} lg={6} key={card.title}>
                  <Card style={statCardStyle} styles={{ body: { padding: 24 } }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: card.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        color: card.color,
                        flexShrink: 0,
                      }}>
                        {card.icon}
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                          {card.title}
                        </Text>
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                          {card.value}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            {/* Recent sessions */}
            <Card
              title={
                <Text strong style={{ color: '#fff', fontSize: 16 }}>
                  Recent Sessions
                </Text>
              }
              style={statCardStyle}
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}
            >
              <Table
                dataSource={recentSessions}
                columns={columns}
                rowKey="id"
                pagination={false}
                locale={{ emptyText: 'No sessions yet' }}
                style={{ background: 'transparent' }}
              />
            </Card>
          </>
        )}
      </div>
    </AntdConfigProvider>
  );
}

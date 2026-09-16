'use client';

import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Tag, Spin, Badge } from 'antd';
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
import StylishLoader from '@/components/StylishLoader';
import SharedTable from '@/components/SharedTable';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  openSessions: number;
  todayAttendance: number;
}

const statCardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E4E4E4',
  borderRadius: 0,
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
      color: '#2563EB',
      bg: '#EFF6FF',
    },
    {
      title: 'Total Classes',
      value: stats?.totalClasses ?? 0,
      icon: <BookOutlined />,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    {
      title: 'Open Sessions',
      value: stats?.openSessions ?? 0,
      icon: <ClockCircleOutlined />,
      color: '#16A34A',
      bg: '#F0FDF4',
    },
    {
      title: "Today's Attendance",
      value: stats?.todayAttendance ?? 0,
      icon: <CheckCircleOutlined />,
      color: '#D97706',
      bg: '#FFFBEB',
    },
  ];

  const columns = [
    {
      title: 'Class',
      dataIndex: ['class', 'name'],
      key: 'class',
      width: 250,
      render: (name: string, row: any) => (
        <div>
          <div style={{ color: '#111111', fontWeight: 600 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.class?.course_code}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => (
        <Badge
          status={status === 'open' ? 'processing' : 'default'}
          text={
            <Tag
              color={status === 'open' ? 'green' : 'default'}
              style={{ borderRadius: 0 }}
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
      width: 160,
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
          <Title level={2} style={{ color: '#111111', margin: 0, fontWeight: 700 }}>
            Dashboard
          </Title>
          <Text type="secondary">
            Welcome back! Here&apos;s what&apos;s happening today.
          </Text>
        </div>

        {loading ? (
          <StylishLoader
            message="Loading dashboard metrics..."
            submessage="Gathering live attendance sessions and student data"
          />
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
                        borderRadius: 0,
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
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#111111', lineHeight: 1 }}>
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
                <Text strong style={{ color: '#111111', fontSize: 15 }}>
                  Recent Sessions
                </Text>
              }
              style={statCardStyle}
              styles={{ header: { borderBottom: '1px solid #E4E4E4' } }}
            >
              <SharedTable
                dataSource={recentSessions}
                columns={columns}
                rowKey="id"
                pagination={false}
                scroll={{ x: 550 }}
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

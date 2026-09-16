'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Button, Badge } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BookOutlined,
  CheckSquareOutlined,
  HistoryOutlined,
  BarChartOutlined,
  WifiOutlined,
  AuditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { MenuProps } from 'antd';
import AntdConfigProvider from '@/components/AntdConfigProvider';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const menuItems: MenuProps['items'] = [
  { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/students', icon: <TeamOutlined />, label: 'Students' },
  { key: '/admin/classes', icon: <BookOutlined />, label: 'Classes' },
  {
    key: 'attendance-group',
    icon: <CheckSquareOutlined />,
    label: 'Attendance',
    children: [
      { key: '/admin/attendance', label: 'Open Attendance' },
      { key: '/admin/history', label: 'History' },
    ],
  },
  { key: '/admin/reports', icon: <BarChartOutlined />, label: 'Reports' },
  { key: '/admin/networks', icon: <WifiOutlined />, label: 'Campus Networks' },
  { key: '/admin/audit', icon: <AuditOutlined />, label: 'Audit Logs' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'signout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleSignOut,
      danger: true,
    },
  ];

  // Find selected key (match current path)
  const selectedKey = menuItems
    .flatMap((item: any) => (item.children ? item.children : [item]))
    .map((item: any) => item.key as string)
    .filter(Boolean)
    .reduce((best: string, key: string) => {
      if (pathname === key) return key;
      if (pathname.startsWith(key) && key.length > best.length) return key;
      return best;
    }, '');

  return (
    <AntdConfigProvider>
      <Layout style={{ minHeight: '100vh', background: '#0d0d1a' }}>
        {/* Sidebar */}
        <Sider
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={240}
          collapsedWidth={72}
          style={{
            background: 'linear-gradient(180deg, #12122a 0%, #0d0d1a 100%)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            overflow: 'auto',
          }}
        >
          {/* Logo */}
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 20px' : '0 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            gap: 12,
            overflow: 'hidden',
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            }}>
              <CheckSquareOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            {!collapsed && (
              <Text strong style={{ color: '#fff', fontSize: 18, letterSpacing: -0.5 }}>
                Rollin
              </Text>
            )}
          </div>

          {/* Menu */}
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={['attendance-group']}
            items={menuItems}
            onClick={({ key }) => router.push(key)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px 8px',
            }}
            theme="dark"
          />
        </Sider>

        {/* Main content */}
        <Layout style={{
          marginLeft: collapsed ? 72 : 240,
          transition: 'margin-left 0.2s',
          background: '#0d0d1a',
        }}>
          {/* Header */}
          <Header style={{
            position: 'sticky',
            top: 0,
            zIndex: 99,
            background: 'rgba(13,13,26,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <Avatar
                    size={32}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    icon={<UserOutlined />}
                  />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Admin</Text>
                </div>
              </Dropdown>
            </div>
          </Header>

          {/* Page content */}
          <Content style={{
            padding: '24px',
            minHeight: 'calc(100vh - 64px)',
          }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </AntdConfigProvider>
  );
}

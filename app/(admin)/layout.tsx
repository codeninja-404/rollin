'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Button, Drawer } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BookOutlined,
  CheckSquareOutlined,
  BarChartOutlined,
  WifiOutlined,
  AuditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined,
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
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(['attendance-group']);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  const selectedKey = (menuItems ?? [])
    .flatMap((item: any) => (item?.children ? item.children : [item]))
    .filter(Boolean)
    .map((item: any) => item.key as string)
    .filter(Boolean)
    .reduce((best: string, key: string) => {
      if (pathname === key) return key;
      if (pathname.startsWith(key) && key.length > best.length) return key;
      return best;
    }, '');

  const handleMenuClick = (key: string) => {
    router.push(key);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const renderBrandHeader = (isCollapsed: boolean) => (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        padding: isCollapsed ? '0' : '0 16px',
        borderBottom: '1px solid #E4E4E4',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          background: '#2563EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#FFFFFF',
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        R
      </div>
      {!isCollapsed && (
        <Text strong style={{ color: '#111111', fontSize: 16, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
          Rollin
        </Text>
      )}
    </div>
  );

  return (
    <AntdConfigProvider>
      <Layout style={{ minHeight: '100vh', background: '#FAFAFA' }}>
        {/* Desktop Sidebar — Hidden on mobile via CSS class .desktop-sider */}
        {(!mounted || !isMobile) && (
          <Sider
            className="desktop-sider"
            collapsed={collapsed}
            onCollapse={setCollapsed}
            width={220}
            collapsedWidth={64}
            style={{
              background: '#FFFFFF',
              borderRight: '1px solid #E4E4E4',
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 100,
              height: '100vh',
            }}
          >
            {renderBrandHeader(collapsed)}

            <div style={{ height: 'calc(100vh - 56px)', overflowY: 'auto', overflowX: 'hidden' }}>
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                openKeys={collapsed ? [] : openKeys}
                onOpenChange={(keys) => {
                  if (!collapsed) setOpenKeys(keys as string[]);
                }}
                items={menuItems}
                onClick={({ key }) => handleMenuClick(key)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 4px',
                }}
              />
            </div>
          </Sider>
        )}

        {/* Mobile Navigation Drawer */}
        <Drawer
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          styles={{
            body: { padding: 0, background: '#FFFFFF' },
            header: { display: 'none' },
          }}
          width={240}
        >
          {renderBrandHeader(false)}
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={['attendance-group']}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px 4px',
            }}
          />
        </Drawer>

        {/* Main Content Area */}
        <Layout
          className="admin-main-layout"
          style={{
            marginLeft: mounted ? (isMobile ? 0 : collapsed ? 64 : 220) : undefined,
            transition: mounted ? 'margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            background: '#FAFAFA',
            minWidth: 0,
            minHeight: '100vh',
          }}
        >
          {/* Header */}
          <Header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 99,
              background: '#FFFFFF',
              borderBottom: '1px solid #E4E4E4',
              padding: isMobile ? '0 16px' : '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 56,
              lineHeight: '56px',
            }}
          >
            <Button
              type="text"
              aria-label="Toggle navigation menu"
              icon={
                isMobile ? (
                  <MenuOutlined />
                ) : collapsed ? (
                  <MenuUnfoldOutlined />
                ) : (
                  <MenuFoldOutlined />
                )
              }
              onClick={() => {
                if (isMobile) {
                  setMobileDrawerOpen(true);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
              style={{ color: '#111111', fontSize: 16 }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '4px 10px',
                    background: '#F4F4F5',
                    border: '1px solid #E4E4E4',
                  }}
                >
                  <Avatar
                    size={22}
                    style={{ background: '#2563EB', color: '#FFFFFF', fontSize: 11 }}
                    icon={<UserOutlined />}
                  />
                  <Text style={{ color: '#111111', fontSize: 12, fontWeight: 500 }}>Admin</Text>
                </div>
              </Dropdown>
            </div>
          </Header>

          {/* Page Content */}
          <Content
            style={{
              padding: isMobile ? '16px' : '24px',
              minHeight: 'calc(100vh - 56px)',
              background: '#FAFAFA',
              minWidth: 0,
              overflowX: 'auto',
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </AntdConfigProvider>
  );
}

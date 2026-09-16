'use client';

import React, { useEffect } from 'react';
import { ConfigProvider, theme, Spin } from 'antd';
import { OrbitalSpinner } from '@/components/StylishLoader';

// Set global default indicator for any Spin / Table loading in Ant Design
if (typeof window !== 'undefined') {
  Spin.setDefaultIndicator(<OrbitalSpinner size={36} />);
}

export default function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Spin.setDefaultIndicator(<OrbitalSpinner size={36} />);
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgBase: '#0d0d1a',
          colorBgContainer: 'rgba(255,255,255,0.04)',
          colorBgElevated: '#1a1a2e',
          colorBorder: 'rgba(255,255,255,0.1)',
          colorText: 'rgba(255,255,255,0.87)',
          colorTextSecondary: 'rgba(255,255,255,0.5)',
          borderRadius: 10,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Spin: {
            colorPrimary: '#6366f1',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(99,102,241,0.15)',
            darkItemSelectedColor: '#818cf8',
            darkItemColor: 'rgba(255,255,255,0.6)',
            darkItemHoverColor: 'rgba(255,255,255,0.87)',
            itemBorderRadius: 8,
          },
          Table: {
            headerBg: 'rgba(255,255,255,0.04)',
            rowHoverBg: 'rgba(99,102,241,0.08)',
          },
          Card: {
            paddingLG: 24,
          },
          Modal: {
            contentBg: '#1a1a2e',
            headerBg: '#1a1a2e',
          },
          Drawer: {
            colorBgElevated: '#1a1a2e',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

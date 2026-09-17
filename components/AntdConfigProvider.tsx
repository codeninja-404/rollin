'use client';

import React, { useEffect } from 'react';
import { ConfigProvider, theme, Spin, App } from 'antd';
import { OrbitalSpinner } from '@/components/StylishLoader';

// Set global default indicator for any Spin / Table loading in Ant Design
if (typeof window !== 'undefined') {
  Spin.setDefaultIndicator(<OrbitalSpinner size={32} />);
}

export default function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Spin.setDefaultIndicator(<OrbitalSpinner size={32} />);
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563EB',
          colorBgBase: '#FAFAFA',
          colorBgContainer: '#FFFFFF',
          colorBgElevated: '#FFFFFF',
          colorBorder: '#E4E4E4',
          colorBorderSecondary: '#E4E4E4',
          colorText: '#111111',
          colorTextSecondary: '#6B6B6B',
          colorError: '#DC2626',
          colorSuccess: '#16A34A',
          colorWarning: '#D97706',
          borderRadius: 0,
          borderRadiusSM: 0,
          borderRadiusLG: 0,
          borderRadiusXS: 0,
          boxShadow: 'none',
          boxShadowSecondary: 'none',
          boxShadowTertiary: 'none',
          wireframe: true,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Spin: {
            colorPrimary: '#2563EB',
          },
          Button: {
            borderRadius: 0,
            borderRadiusSM: 0,
            borderRadiusLG: 0,
            boxShadow: 'none',
            primaryShadow: 'none',
          },
          Input: {
            borderRadius: 0,
            borderRadiusSM: 0,
            borderRadiusLG: 0,
            colorBgContainer: '#FFFFFF',
            colorBorder: '#E4E4E4',
          },
          Select: {
            borderRadius: 0,
            borderRadiusSM: 0,
            borderRadiusLG: 0,
            colorBgContainer: '#FFFFFF',
            colorBorder: '#E4E4E4',
          },
          Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
            itemSelectedBg: '#EFF6FF',
            itemSelectedColor: '#2563EB',
            itemColor: '#111111',
            itemHoverColor: '#2563EB',
            itemHoverBg: '#F4F4F5',
            itemBorderRadius: 0,
            subMenuItemBorderRadius: 0,
          },
          Table: {
            headerBg: '#F4F4F5',
            headerColor: '#52525B',
            rowHoverBg: '#F8FAFC',
            cellPaddingBlock: 7,
            cellPaddingBlockMD: 6,
            cellPaddingBlockSM: 5,
            cellPaddingInline: 12,
            cellPaddingInlineMD: 10,
            cellPaddingInlineSM: 8,
            fontSize: 12.5,
            borderRadius: 0,
          },
          Card: {
            paddingLG: 20,
            colorBgContainer: '#FFFFFF',
            colorBorderSecondary: '#E4E4E4',
            borderRadiusLG: 0,
          },
          Modal: {
            contentBg: '#FFFFFF',
            headerBg: '#FFFFFF',
            borderRadiusLG: 0,
            boxShadow: 'none',
          },
          Drawer: {
            colorBgElevated: '#FFFFFF',
            borderRadiusLG: 0,
            boxShadow: 'none',
          },
          Tag: {
            borderRadiusSM: 0,
          },
          Badge: {
            borderRadius: 0,
          },
          Pagination: {
            borderRadius: 0,
            itemSize: 28,
            itemSizeSM: 26,
          },
          Progress: {
            lineBorderRadius: 0,
          },
          Tooltip: {
            borderRadius: 0,
          },
          Notification: {
            borderRadiusLG: 0,
          },
        },
      }}
    >
      <App style={{ minHeight: '100%', width: '100%' }}>
        {children}
      </App>
    </ConfigProvider>
  );
}

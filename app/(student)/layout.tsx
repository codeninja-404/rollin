import type { Metadata } from 'next';
import AntdConfigProvider from '@/components/AntdConfigProvider';

export const metadata: Metadata = {
  title: 'Attendance — Rollin',
  description: 'Submit your class attendance',
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AntdConfigProvider>
      <div style={{
        minHeight: '100vh',
        background: '#FAFAFA',
      }}>
        {children}
      </div>
    </AntdConfigProvider>
  );
}

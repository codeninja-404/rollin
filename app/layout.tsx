import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FAFAFA',
};

export const metadata: Metadata = {
  title: 'Rollin — Class Attendance System',
  description: 'Smart attendance management with rotating OTP verification and campus network security.',
};

import TopProgressBar from '@/components/TopProgressBar';
import { Suspense } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        style={{ margin: 0, padding: 0, background: '#FAFAFA', color: '#111111', minHeight: '100vh' }}
      >
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}

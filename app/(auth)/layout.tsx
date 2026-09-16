import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — Rollin',
  description: 'Sign in to the Rollin Class Attendance System',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}

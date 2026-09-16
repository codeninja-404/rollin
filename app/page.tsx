import { redirect } from 'next/navigation';

// Root page — middleware handles role-based redirect,
// but as a fallback redirect to login
export default function RootPage() {
  redirect('/login');
}

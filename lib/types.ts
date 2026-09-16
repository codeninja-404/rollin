// Shared TypeScript types for Rollin

export type StudentStatus = 'active' | 'inactive';
export type ClassStatus = 'active' | 'inactive';
export type SessionStatus = 'open' | 'closed';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type NetworkStatus = 'active' | 'inactive';

export interface Student {
  id: string;
  auth_user_id: string | null;
  student_code: string;
  name: string;
  email: string;
  department: string | null;
  semester: number | null;
  section: string | null;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  course_code: string;
  name: string;
  department: string | null;
  semester: number | null;
  section: string | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
}

export interface ClassStudent {
  id: string;
  class_id: string;
  student_id: string;
  status: string;
  created_at: string;
  // Joined
  student?: Student;
  class?: Class;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  started_at: string;
  ended_at: string | null;
  otp_secret: string;
  otp_period?: number;
  status: SessionStatus;
  created_by: string | null;
  created_at: string;
  // Joined
  class?: Class;
}

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  marked_at: string;
  ip_address: string | null;
  user_agent: string | null;
  status: AttendanceStatus;
  created_at: string;
  // Joined
  student?: Student;
  session?: AttendanceSession;
}

export interface CampusNetwork {
  id: string;
  name: string;
  cidr: string;
  status: NetworkStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  auth_user_id: string;
  name: string | null;
  email: string | null;
  created_at: string;
}

// CSV import row shape
export interface CsvStudentRow {
  student_code: string;
  name: string;
  email: string;
  department?: string;
  semester?: string;
  section?: string;
}

// OTP response
export interface OtpResponse {
  otp: string;
  seconds_remaining: number;
  period: number;
}

// Student active session response
export interface ActiveSessionResponse {
  session: AttendanceSession | null;
  already_attended: boolean;
  attendance?: Attendance;
}

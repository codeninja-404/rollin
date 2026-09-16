-- Add otp_period to attendance_sessions
alter table attendance_sessions add column if not exists otp_period integer default 5;

-- Create system_settings table for global configuration
create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Insert default OTP rolling period
insert into system_settings (key, value)
values ('default_otp_period', '5'::jsonb)
on conflict (key) do nothing;

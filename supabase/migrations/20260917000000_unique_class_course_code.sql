-- Migration: Ensure unique course_code in classes
create unique index if not exists idx_classes_course_code_unique on classes (lower(trim(course_code)));

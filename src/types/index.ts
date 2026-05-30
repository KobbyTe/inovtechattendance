export interface Student {
  id: string;
  student_id: string;
  full_name: string;
  year_level: string;
  created_at: string;
  cohort_id: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  student_email: string | null;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  clock_in: string;
  clock_out: string | null;
  date: string;
  day_name: string;
  created_at: string;
}

export interface Cohort {
  id: string;
  name: string;
  code: string;
  duration_weeks: number | null;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
  color: string;
  created_at: string;
}
export interface Student {
  id: string;
  student_id: string;
  full_name: string;
  year_level: string;
  created_at: string;
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
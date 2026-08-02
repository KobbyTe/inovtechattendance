export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string
          date: string
          day_name: string
          id: string
          student_id: string
          student_name: string
        }
        Insert: {
          created_at?: string
          date: string
          day_name: string
          id?: string
          student_id: string
          student_name: string
        }
        Update: {
          created_at?: string
          date?: string
          day_name?: string
          id?: string
          student_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          clockin_guardian_body: string | null
          clockin_guardian_subject: string | null
          clockin_student_body: string | null
          clockin_student_subject: string | null
          clockout_guardian_body: string | null
          clockout_guardian_subject: string | null
          clockout_student_body: string | null
          clockout_student_subject: string | null
          email_body: string | null
          email_header: string | null
          email_header_image_url: string | null
          email_signature: string | null
          email_subject: string | null
          google_sheet_id: string | null
          id: string
          last_sheets_sync_at: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          clockin_guardian_body?: string | null
          clockin_guardian_subject?: string | null
          clockin_student_body?: string | null
          clockin_student_subject?: string | null
          clockout_guardian_body?: string | null
          clockout_guardian_subject?: string | null
          clockout_student_body?: string | null
          clockout_student_subject?: string | null
          email_body?: string | null
          email_header?: string | null
          email_header_image_url?: string | null
          email_signature?: string | null
          email_subject?: string | null
          google_sheet_id?: string | null
          id?: string
          last_sheets_sync_at?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          clockin_guardian_body?: string | null
          clockin_guardian_subject?: string | null
          clockin_student_body?: string | null
          clockin_student_subject?: string | null
          clockout_guardian_body?: string | null
          clockout_guardian_subject?: string | null
          clockout_student_body?: string | null
          clockout_student_subject?: string | null
          email_body?: string | null
          email_header?: string | null
          email_header_image_url?: string | null
          email_signature?: string | null
          email_subject?: string | null
          google_sheet_id?: string | null
          id?: string
          last_sheets_sync_at?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          date: string
          day_name: string
          id: string
          source: string
          student_id: string
          student_name: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          date?: string
          day_name: string
          id?: string
          source?: string
          student_id: string
          student_name: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          date?: string
          day_name?: string
          id?: string
          source?: string
          student_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      cohort_status_overrides: {
        Row: {
          admin_user_id: string
          cohort_id: string
          created_at: string
          from_status: string
          id: string
          reason: string
          to_status: string
        }
        Insert: {
          admin_user_id: string
          cohort_id: string
          created_at?: string
          from_status: string
          id?: string
          reason: string
          to_status: string
        }
        Update: {
          admin_user_id?: string
          cohort_id?: string
          created_at?: string
          from_status?: string
          id?: string
          reason?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_status_overrides_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_yearbooks: {
        Row: {
          cohort_id: string
          created_at: string
          generated_at: string
          id: string
          snapshot: Json
        }
        Insert: {
          cohort_id: string
          created_at?: string
          generated_at?: string
          id?: string
          snapshot?: Json
        }
        Update: {
          cohort_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cohort_yearbooks_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: true
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          code: string
          color: string
          created_at: string
          duration_weeks: number | null
          end_date: string | null
          ended_at: string | null
          grace_period_days: number
          id: string
          is_ended: boolean
          is_ongoing: boolean
          name: string
          start_date: string | null
          status: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          duration_weeks?: number | null
          end_date?: string | null
          ended_at?: string | null
          grace_period_days?: number
          id?: string
          is_ended?: boolean
          is_ongoing?: boolean
          name: string
          start_date?: string | null
          status?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          duration_weeks?: number | null
          end_date?: string | null
          ended_at?: string | null
          grace_period_days?: number
          id?: string
          is_ended?: boolean
          is_ongoing?: boolean
          name?: string
          start_date?: string | null
          status?: string
        }
        Relationships: []
      }
      session_reviews: {
        Row: {
          achievements: string | null
          ai_analyzed_at: string | null
          attendance_id: string | null
          class_feedback: string | null
          class_rating: number
          cohort_id: string | null
          date: string
          enjoyment: boolean | null
          id: string
          keywords: string[]
          sentiment: string | null
          student_id: string
          student_name: string
          submitted_at: string
          tags: string[]
          teacher_note: string | null
        }
        Insert: {
          achievements?: string | null
          ai_analyzed_at?: string | null
          attendance_id?: string | null
          class_feedback?: string | null
          class_rating: number
          cohort_id?: string | null
          date: string
          enjoyment?: boolean | null
          id?: string
          keywords?: string[]
          sentiment?: string | null
          student_id: string
          student_name: string
          submitted_at?: string
          tags?: string[]
          teacher_note?: string | null
        }
        Update: {
          achievements?: string | null
          ai_analyzed_at?: string | null
          attendance_id?: string | null
          class_feedback?: string | null
          class_rating?: number
          cohort_id?: string | null
          date?: string
          enjoyment?: boolean | null
          id?: string
          keywords?: string[]
          sentiment?: string | null
          student_id?: string
          student_name?: string
          submitted_at?: string
          tags?: string[]
          teacher_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_reviews_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reviews_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          cohort_id: string | null
          created_at: string
          full_name: string
          guardian_email: string | null
          guardian_name: string | null
          id: string
          rfid_uid: string | null
          student_email: string | null
          student_id: string
          year_level: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          full_name: string
          guardian_email?: string | null
          guardian_name?: string | null
          id?: string
          rfid_uid?: string | null
          student_email?: string | null
          student_id: string
          year_level: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          full_name?: string
          guardian_email?: string | null
          guardian_name?: string | null
          id?: string
          rfid_uid?: string | null
          student_email?: string | null
          student_id?: string
          year_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_admin_if_none: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const

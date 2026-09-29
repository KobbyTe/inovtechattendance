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
      announcement_recipients: {
        Row: {
          announcement_id: string
          channel: string
          contact_value: string
          created_at: string
          error: string | null
          id: string
          provider_message_id: string | null
          recipient_type: string
          sent_at: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          announcement_id: string
          channel: string
          contact_value: string
          created_at?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_type: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
        }
        Update: {
          announcement_id?: string
          channel?: string
          contact_value?: string
          created_at?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["student_id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience_filter: Json | null
          body_html: string
          body_plain: string
          cohort_id: string | null
          created_at: string
          created_by: string
          flyer_image_url: string | null
          id: string
          program_form_link: string | null
          scheduled_at: string | null
          slug: string
          status: string
          target_audience: string
          title: string
        }
        Insert: {
          audience_filter?: Json | null
          body_html: string
          body_plain: string
          cohort_id?: string | null
          created_at?: string
          created_by: string
          flyer_image_url?: string | null
          id?: string
          program_form_link?: string | null
          scheduled_at?: string | null
          slug: string
          status?: string
          target_audience?: string
          title: string
        }
        Update: {
          audience_filter?: Json | null
          body_html?: string
          body_plain?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string
          flyer_image_url?: string | null
          id?: string
          program_form_link?: string | null
          scheduled_at?: string | null
          slug?: string
          status?: string
          target_audience?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          absence_sms_template: string | null
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
          payment_notify_enabled: boolean
          payment_overdue_body: string | null
          payment_overdue_cadence: number[]
          payment_overdue_sms: string | null
          payment_overdue_subject: string | null
          payment_receipt_body: string | null
          payment_receipt_sms: string | null
          payment_receipt_subject: string | null
          payment_reminder_body: string | null
          payment_reminder_days_before: number
          payment_reminder_sms: string | null
          payment_reminder_subject: string | null
          singleton: boolean
          sms_enabled: boolean
          sms_sender_id: string | null
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_payment_overdue_template: string | null
          whatsapp_payment_received_template: string | null
          whatsapp_payment_reminder_template: string | null
          whatsapp_template_lang: string
          whatsapp_template_name: string | null
        }
        Insert: {
          absence_sms_template?: string | null
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
          payment_notify_enabled?: boolean
          payment_overdue_body?: string | null
          payment_overdue_cadence?: number[]
          payment_overdue_sms?: string | null
          payment_overdue_subject?: string | null
          payment_receipt_body?: string | null
          payment_receipt_sms?: string | null
          payment_receipt_subject?: string | null
          payment_reminder_body?: string | null
          payment_reminder_days_before?: number
          payment_reminder_sms?: string | null
          payment_reminder_subject?: string | null
          singleton?: boolean
          sms_enabled?: boolean
          sms_sender_id?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_payment_overdue_template?: string | null
          whatsapp_payment_received_template?: string | null
          whatsapp_payment_reminder_template?: string | null
          whatsapp_template_lang?: string
          whatsapp_template_name?: string | null
        }
        Update: {
          absence_sms_template?: string | null
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
          payment_notify_enabled?: boolean
          payment_overdue_body?: string | null
          payment_overdue_cadence?: number[]
          payment_overdue_sms?: string | null
          payment_overdue_subject?: string | null
          payment_receipt_body?: string | null
          payment_receipt_sms?: string | null
          payment_receipt_subject?: string | null
          payment_reminder_body?: string | null
          payment_reminder_days_before?: number
          payment_reminder_sms?: string | null
          payment_reminder_subject?: string | null
          singleton?: boolean
          sms_enabled?: boolean
          sms_sender_id?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_payment_overdue_template?: string | null
          whatsapp_payment_received_template?: string | null
          whatsapp_payment_reminder_template?: string | null
          whatsapp_template_lang?: string
          whatsapp_template_name?: string | null
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
      invoice_notifications: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          kind: string
          payment_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          kind: string
          payment_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          kind?: string
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_notifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          balance_remaining: number
          created_at: string
          due_date: string
          id: string
          installment_label: string
          status: string
          student_payment_plan_id: string
          updated_at: string
          waived_by: string | null
          waived_reason: string | null
        }
        Insert: {
          amount_due: number
          balance_remaining: number
          created_at?: string
          due_date: string
          id?: string
          installment_label: string
          status?: string
          student_payment_plan_id: string
          updated_at?: string
          waived_by?: string | null
          waived_reason?: string | null
        }
        Update: {
          amount_due?: number
          balance_remaining?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_label?: string
          status?: string
          student_payment_plan_id?: string
          updated_at?: string
          waived_by?: string | null
          waived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_payment_plan_id_fkey"
            columns: ["student_payment_plan_id"]
            isOneToOne: false
            referencedRelation: "student_payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          date: string | null
          error: string | null
          id: string
          invoice_id: string | null
          kind: string
          provider: string
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          student_id: string | null
          student_name: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          date?: string | null
          error?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          provider: string
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          student_name?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          date?: string | null
          error?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          provider?: string
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          cohort_id: string
          created_at: string
          created_by: string
          currency: string
          id: string
          installment_count: number
          installment_schedule: Json
          name: string
          total_amount: number
        }
        Insert: {
          cohort_id: string
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          installment_count?: number
          installment_schedule?: Json
          name: string
          total_amount: number
        }
        Update: {
          cohort_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          installment_count?: number
          installment_schedule?: Json
          name?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          channel: string
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          note: string | null
          overpayment_amount: number
          paid_at: string
          provider: string | null
          provider_reference: string | null
          reconciled_at: string | null
          recorded_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          amount: number
          channel: string
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          overpayment_amount?: number
          paid_at?: string
          provider?: string | null
          provider_reference?: string | null
          reconciled_at?: string | null
          recorded_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          amount?: number
          channel?: string
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          overpayment_amount?: number
          paid_at?: string
          provider?: string | null
          provider_reference?: string | null
          reconciled_at?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
      student_payment_plans: {
        Row: {
          cohort_id: string
          enrolled_at: string
          id: string
          payment_plan_id: string
          status: string
          student_id: string
        }
        Insert: {
          cohort_id: string
          enrolled_at?: string
          id?: string
          payment_plan_id: string
          status?: string
          student_id: string
        }
        Update: {
          cohort_id?: string
          enrolled_at?: string
          id?: string
          payment_plan_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payment_plans_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_plans_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          guardian_msg_opt_out: boolean
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          marketing_opt_in: boolean
          photo_url: string | null
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
          guardian_msg_opt_out?: boolean
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          marketing_opt_in?: boolean
          photo_url?: string | null
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
          guardian_msg_opt_out?: boolean
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          marketing_opt_in?: boolean
          photo_url?: string | null
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
      apply_payment_to_invoice: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      claim_admin_if_none: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_overdue_invoices: { Args: never; Returns: number }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

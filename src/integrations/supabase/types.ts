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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      acts_engineers: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          email: string | null
          governorate: string | null
          grad_year: number | null
          id: string
          kind: string
          name: string
          phone: string
          photo_url: string | null
          projects: Json
          qualifications: string | null
          reject_reason: string | null
          services: string[]
          skills: string[]
          specialty: string
          status: string
          tools: string[]
          university: string | null
          updated_at: string
          years_exp: number
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          governorate?: string | null
          grad_year?: number | null
          id?: string
          kind?: string
          name: string
          phone: string
          photo_url?: string | null
          projects?: Json
          qualifications?: string | null
          reject_reason?: string | null
          services?: string[]
          skills?: string[]
          specialty: string
          status?: string
          tools?: string[]
          university?: string | null
          updated_at?: string
          years_exp?: number
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          governorate?: string | null
          grad_year?: number | null
          id?: string
          kind?: string
          name?: string
          phone?: string
          photo_url?: string | null
          projects?: Json
          qualifications?: string | null
          reject_reason?: string | null
          services?: string[]
          skills?: string[]
          specialty?: string
          status?: string
          tools?: string[]
          university?: string | null
          updated_at?: string
          years_exp?: number
        }
        Relationships: []
      }
      acts_review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          resolved: boolean
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          resolved?: boolean
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          resolved?: boolean
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acts_review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "acts_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      acts_reviews: {
        Row: {
          comment: string | null
          created_at: string
          engineer_id: string
          hidden: boolean
          id: string
          professionalism: number
          punctuality: number
          quality: number
          rating: number
          request_id: string
          responsiveness: number
          reviewer_name: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          engineer_id: string
          hidden?: boolean
          id?: string
          professionalism: number
          punctuality: number
          quality: number
          rating: number
          request_id: string
          responsiveness: number
          reviewer_name?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          engineer_id?: string
          hidden?: boolean
          id?: string
          professionalism?: number
          punctuality?: number
          quality?: number
          rating?: number
          request_id?: string
          responsiveness?: number
          reviewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acts_reviews_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "acts_engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acts_reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "acts_service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      acts_service_requests: {
        Row: {
          admin_notes: string | null
          attachments: Json
          city: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          description: string
          engineer_id: string | null
          governorate: string | null
          id: string
          location: string | null
          name: string | null
          phone: string
          review_token: string
          service: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          attachments?: Json
          city?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string
          engineer_id?: string | null
          governorate?: string | null
          id?: string
          location?: string | null
          name?: string | null
          phone: string
          review_token?: string
          service: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          attachments?: Json
          city?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string
          engineer_id?: string | null
          governorate?: string | null
          id?: string
          location?: string | null
          name?: string | null
          phone?: string
          review_token?: string
          service?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "acts_service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acts_service_requests_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "acts_engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          text_value: string | null
          updated_at: string
          value: number
        }
        Insert: {
          key: string
          text_value?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          key?: string
          text_value?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      bot_button_locks: {
        Row: {
          choice: string | null
          context_id: string
          created_at: string
          phone: string | null
        }
        Insert: {
          choice?: string | null
          context_id: string
          created_at?: string
          phone?: string | null
        }
        Update: {
          choice?: string | null
          context_id?: string
          created_at?: string
          phone?: string | null
        }
        Relationships: []
      }
      bot_steps: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          kind: string
          list_button: string | null
          options: Json
          section: string | null
          trigger_id: string | null
          trigger_key: string | null
          trigger_title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          kind?: string
          list_button?: string | null
          options?: Json
          section?: string | null
          trigger_id?: string | null
          trigger_key?: string | null
          trigger_title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          kind?: string
          list_button?: string | null
          options?: Json
          section?: string | null
          trigger_id?: string | null
          trigger_key?: string | null
          trigger_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bot_texts: {
        Row: {
          btn_desc: string | null
          btn_id: string | null
          desc_value: string | null
          key: string
          kind: string
          msg_key: string
          original: string
          place: string | null
          section: string
          sort: number
          updated_at: string
          value: string | null
        }
        Insert: {
          btn_desc?: string | null
          btn_id?: string | null
          desc_value?: string | null
          key: string
          kind?: string
          msg_key: string
          original: string
          place?: string | null
          section?: string
          sort?: number
          updated_at?: string
          value?: string | null
        }
        Update: {
          btn_desc?: string | null
          btn_id?: string | null
          desc_value?: string | null
          key?: string
          kind?: string
          msg_key?: string
          original?: string
          place?: string | null
          section?: string
          sort?: number
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      catalog_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      catalog_chunks: {
        Row: {
          catalog_id: string
          content: string
          created_at: string
          fts: unknown
          id: string
          page: number
        }
        Insert: {
          catalog_id: string
          content: string
          created_at?: string
          fts?: unknown
          id?: string
          page?: number
        }
        Update: {
          catalog_id?: string
          content?: string
          created_at?: string
          fts?: unknown
          id?: string
          page?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_chunks_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          active: boolean
          auto_rules: Json
          category: string
          category_title: string | null
          key: string
          kind: string
          label: string | null
          name: string
          pdf_url: string | null
          price: number | null
          sort: number
          specs: Json
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_rules?: Json
          category?: string
          category_title?: string | null
          key: string
          kind?: string
          label?: string | null
          name: string
          pdf_url?: string | null
          price?: number | null
          sort?: number
          specs?: Json
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_rules?: Json
          category?: string
          category_title?: string | null
          key?: string
          kind?: string
          label?: string | null
          name?: string
          pdf_url?: string | null
          price?: number | null
          sort?: number
          specs?: Json
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catalog_profiles: {
        Row: {
          catalog_id: string
          specs: Json
          summary_ar: string
          summary_en: string
          updated_at: string
        }
        Insert: {
          catalog_id: string
          specs?: Json
          summary_ar?: string
          summary_en?: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          specs?: Json
          summary_ar?: string
          summary_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_profiles_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: true
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          category_id: string | null
          cover_path: string | null
          created_at: string
          description: string
          file_path: string
          id: string
          keywords: string
          language: string
          page_count: number
          title: string
        }
        Insert: {
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string
          file_path: string
          id?: string
          keywords?: string
          language?: string
          page_count?: number
          title: string
        }
        Update: {
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string
          file_path?: string
          id?: string
          keywords?: string
          language?: string
          page_count?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          blocked: boolean
          bot_paused: boolean
          city: string | null
          created_at: string
          deleted_at: string | null
          hidden_before: string | null
          id: string
          last_at: string
          last_message: string | null
          name: string | null
          notes: string | null
          phone: string
          stage: string
          system: string | null
          unread: number
        }
        Insert: {
          blocked?: boolean
          bot_paused?: boolean
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          hidden_before?: string | null
          id?: string
          last_at?: string
          last_message?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          stage?: string
          system?: string | null
          unread?: number
        }
        Update: {
          blocked?: boolean
          bot_paused?: boolean
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          hidden_before?: string | null
          id?: string
          last_at?: string
          last_message?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          stage?: string
          system?: string | null
          unread?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          customer_id: string
          direction: string
          file_name: string | null
          id: string
          kind: string
          media_id: string | null
          media_url: string | null
          mime: string | null
          text: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          direction?: string
          file_name?: string | null
          id?: string
          kind?: string
          media_id?: string | null
          media_url?: string | null
          mime?: string | null
          text?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          direction?: string
          file_name?: string | null
          id?: string
          kind?: string
          media_id?: string | null
          media_url?: string | null
          mime?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          payload: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: string | null
          city: string | null
          created_at: string
          customer_id: string | null
          decided_at: string | null
          details: string | null
          id: string
          invoice_no: string | null
          method: string | null
          name: string | null
          phone: string
          status: string
        }
        Insert: {
          amount?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          decided_at?: string | null
          details?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          name?: string | null
          phone: string
          status?: string
        }
        Update: {
          amount?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          decided_at?: string | null
          details?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          name?: string | null
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_legacy: {
        Row: {
          created_at: string
          id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          payload: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      preset_reports: {
        Row: {
          file_name: string
          kind: string
          path: string
          preset_title: string
          updated_at: string
        }
        Insert: {
          file_name: string
          kind: string
          path: string
          preset_title: string
          updated_at?: string
        }
        Update: {
          file_name?: string
          kind?: string
          path?: string
          preset_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          city: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          items: Json
          notes: string | null
          phone: string | null
          quote_no: string
          total: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          phone?: string | null
          quote_no?: string
          total?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          phone?: string | null
          quote_no?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      report_requests: {
        Row: {
          azimuth: string | null
          city: string | null
          created_at: string
          customer_id: string | null
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          lat: number | null
          loads: Json | null
          lon: number | null
          name: string | null
          phone: string
          sent_at: string | null
          status: string
          system_label: string | null
          tilt: number | null
        }
        Insert: {
          azimuth?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          lat?: number | null
          loads?: Json | null
          lon?: number | null
          name?: string | null
          phone: string
          sent_at?: string | null
          status?: string
          system_label?: string | null
          tilt?: number | null
        }
        Update: {
          azimuth?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          lat?: number | null
          loads?: Json | null
          lon?: number | null
          name?: string | null
          phone?: string
          sent_at?: string | null
          status?: string
          system_label?: string | null
          tilt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "report_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          city: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          device: string | null
          id: string
          issue_type: string | null
          media_id: string | null
          media_type: string | null
          name: string | null
          phone: string
          resolved_at: string | null
          status: string
          ticket_no: string
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          device?: string | null
          id?: string
          issue_type?: string | null
          media_id?: string | null
          media_type?: string | null
          name?: string | null
          phone: string
          resolved_at?: string | null
          status?: string
          ticket_no?: string
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          device?: string | null
          id?: string
          issue_type?: string | null
          media_id?: string | null
          media_type?: string | null
          name?: string | null
          phone?: string
          resolved_at?: string | null
          status?: string
          ticket_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_catalog_chunks: {
        Args: { lim?: number; q: string }
        Returns: {
          catalog_id: string
          content: string
          page: number
          score: number
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

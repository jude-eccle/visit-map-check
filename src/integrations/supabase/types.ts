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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          acknowledged: boolean
          assigned_at: string
          id: string
          map_id: string
          team_name: string
        }
        Insert: {
          acknowledged?: boolean
          assigned_at?: string
          id?: string
          map_id: string
          team_name: string
        }
        Update: {
          acknowledged?: boolean
          assigned_at?: string
          id?: string
          map_id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      handoffs: {
        Row: {
          created_at: string
          id: string
          kind: string
          map_id: string
          note: string
          photo_url: string | null
          team_name: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          map_id: string
          note?: string
          photo_url?: string | null
          team_name: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          map_id?: string
          note?: string
          photo_url?: string | null
          team_name?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoffs_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          address: string
          code: string
          created_at: string
          id: string
          image_path: string | null
          name: string
          team_memo: string
          total_houses: number
        }
        Insert: {
          address?: string
          code: string
          created_at?: string
          id?: string
          image_path?: string | null
          name: string
          team_memo?: string
          total_houses?: number
        }
        Update: {
          address?: string
          code?: string
          created_at?: string
          id?: string
          image_path?: string | null
          name?: string
          team_memo?: string
          total_houses?: number
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          created_at: string
          id: string
          map_id: string
          resolved: boolean
          team_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          map_id: string
          resolved?: boolean
          team_name: string
        }
        Update: {
          created_at?: string
          id?: string
          map_id?: string
          resolved?: boolean
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_completions: {
        Row: {
          acknowledged: boolean
          counters: Json
          created_at: string
          id: string
          map_id: string
          team_name: string
          zone_id: string
        }
        Insert: {
          acknowledged?: boolean
          counters?: Json
          created_at?: string
          id?: string
          map_id: string
          team_name: string
          zone_id: string
        }
        Update: {
          acknowledged?: boolean
          counters?: Json
          created_at?: string
          id?: string
          map_id?: string
          team_name?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_completions_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_completions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_events: {
        Row: {
          category: string
          created_at: string
          id: string
          map_id: string
          team_name: string
          zone_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          map_id: string
          team_name: string
          zone_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          map_id?: string
          team_name?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_events_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_events_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          id: string
          map_id: string
          name: string
          order_idx: number
          status: string
          updated_at: string
          x1_pct: number
          x2_pct: number
          y1_pct: number
          y2_pct: number
        }
        Insert: {
          created_at?: string
          id?: string
          map_id: string
          name?: string
          order_idx?: number
          status?: string
          updated_at?: string
          x1_pct: number
          x2_pct: number
          y1_pct: number
          y2_pct: number
        }
        Update: {
          created_at?: string
          id?: string
          map_id?: string
          name?: string
          order_idx?: number
          status?: string
          updated_at?: string
          x1_pct?: number
          x2_pct?: number
          y1_pct?: number
          y2_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "zones_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      pin_status: "done" | "gift" | "refuse" | "away" | "skip"
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
      pin_status: ["done", "gift", "refuse", "away", "skip"],
    },
  },
} as const

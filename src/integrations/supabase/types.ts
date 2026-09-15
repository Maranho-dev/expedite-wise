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
      checklists_esperados: {
        Row: {
          chave: string
          checklist_id: string | null
          cliente: string | null
          conferente: string | null
          created_at: string
          data_nf: string | null
          finalizado_em: string | null
          nfs: Json
          primeira_deteccao: string
          qtd_nf: number
          resolvido_em: string | null
          status: string
          tipo: string
          transportadora: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          chave: string
          checklist_id?: string | null
          cliente?: string | null
          conferente?: string | null
          created_at?: string
          data_nf?: string | null
          finalizado_em?: string | null
          nfs?: Json
          primeira_deteccao?: string
          qtd_nf?: number
          resolvido_em?: string | null
          status?: string
          tipo: string
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          chave?: string
          checklist_id?: string | null
          cliente?: string | null
          conferente?: string | null
          created_at?: string
          data_nf?: string | null
          finalizado_em?: string | null
          nfs?: Json
          primeira_deteccao?: string
          qtd_nf?: number
          resolvido_em?: string | null
          status?: string
          tipo?: string
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      checklists_realizados: {
        Row: {
          chave: string | null
          checklist_id: string
          conferente: string | null
          created_at: string
          criado_em: string | null
          finalizado_em: string | null
          localidade: string | null
          objeto_raw: string | null
          roteiro: string | null
          status: string | null
          unidade: string | null
        }
        Insert: {
          chave?: string | null
          checklist_id: string
          conferente?: string | null
          created_at?: string
          criado_em?: string | null
          finalizado_em?: string | null
          localidade?: string | null
          objeto_raw?: string | null
          roteiro?: string | null
          status?: string | null
          unidade?: string | null
        }
        Update: {
          chave?: string | null
          checklist_id?: string
          conferente?: string | null
          created_at?: string
          criado_em?: string | null
          finalizado_em?: string | null
          localidade?: string | null
          objeto_raw?: string | null
          roteiro?: string | null
          status?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
      resumo_diario: {
        Row: {
          data_ref: string
          esperados: number
          novas_pendencias: number
          pendencias_antigas: number
          pendencias_resolvidas: number
          processado_em: string
          produtividade: Json
          realizados: number
          saldo_acumulado: number
        }
        Insert: {
          data_ref: string
          esperados?: number
          novas_pendencias?: number
          pendencias_antigas?: number
          pendencias_resolvidas?: number
          processado_em?: string
          produtividade?: Json
          realizados?: number
          saldo_acumulado?: number
        }
        Update: {
          data_ref?: string
          esperados?: number
          novas_pendencias?: number
          pendencias_antigas?: number
          pendencias_resolvidas?: number
          processado_em?: string
          produtividade?: Json
          realizados?: number
          saldo_acumulado?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          customer_id: string
          delivery_instructions: string | null
          id: string
          is_default: boolean | null
          label: string | null
          landmark: string | null
          postal_code: string | null
          recipient_name: string
          recipient_phone: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          customer_id: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          landmark?: string | null
          postal_code?: string | null
          recipient_name: string
          recipient_phone?: string | null
          state: string
          updated_at?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          landmark?: string | null
          postal_code?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          state?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          email_verified: boolean | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          is_active: boolean | null
          last_name: string
          last_order_at: string | null
          notes: string | null
          phone: string | null
          phone_verified: boolean | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          email_verified?: boolean | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          is_active?: boolean | null
          last_name: string
          last_order_at?: string | null
          notes?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          email_verified?: boolean | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          last_order_at?: string | null
          notes?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          customer_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          minimum_order_amount: number | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string | null
          usage_count: number | null
          usage_limit: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          minimum_order_amount?: number | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          minimum_order_amount?: number | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_image_url: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_image_url?: string | null
          product_name: string
          product_sku?: string | null
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_image_url?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["order_status"]
          note: string | null
          notified_customer: boolean | null
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["order_status"]
          note?: string | null
          notified_customer?: boolean | null
          order_id: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"]
          note?: string | null
          notified_customer?: boolean | null
          order_id?: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          currency: string | null
          customer_id: string
          delivered_at: string | null
          discount_amount: number | null
          id: string
          ip_address: string | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipping_address_id: string | null
          shipping_address_snapshot: Json
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string | null
          customer_id: string
          delivered_at?: string | null
          discount_amount?: number | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address_id?: string | null
          shipping_address_snapshot: Json
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          delivered_at?: string | null
          discount_amount?: number | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipping_address_id?: string | null
          shipping_address_snapshot?: Json
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          benefits: Json | null
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          images: Json
          is_available: boolean | null
          is_featured: boolean | null
          low_stock_threshold: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          price: number
          short_description: string | null
          sku: string | null
          slug: string
          stock_quantity: number
          tags: Json | null
          total_orders: number | null
          updated_at: string | null
          weight_grams: number | null
        }
        Insert: {
          benefits?: Json | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_available?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          price: number
          short_description?: string | null
          sku?: string | null
          slug: string
          stock_quantity?: number
          tags?: Json | null
          total_orders?: number | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Update: {
          benefits?: Json | null
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          is_available?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          price?: number
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_quantity?: number
          tags?: Json | null
          total_orders?: number | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          base_rate: number
          created_at: string
          estimated_days_max: number | null
          estimated_days_min: number | null
          id: string
          is_active: boolean | null
          name: string
          states: Json | null
          updated_at: string | null
        }
        Insert: {
          base_rate: number
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          states?: Json | null
          updated_at?: string | null
        }
        Update: {
          base_rate?: number
          created_at?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          states?: Json | null
          updated_at?: string | null
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
      discount_type: "percentage" | "fixed_amount"
      gender_type: "male" | "female" | "prefer_not_to_say"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refunded" | "partially_refunded"
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
      discount_type: ["percentage", "fixed_amount"],
      gender_type: ["male", "female", "prefer_not_to_say"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refunded", "partially_refunded"],
    },
  },
} as const

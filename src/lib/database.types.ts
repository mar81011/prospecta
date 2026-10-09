// Mirrors supabase/migrations. Regenerate with `npm run db:types` after
// changing the schema (requires the local Supabase stack to be running).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type ListingType = "sale" | "rent";
export type PropertyType =
  | "house_and_lot"
  | "condo"
  | "townhouse"
  | "apartment"
  | "lot"
  | "commercial"
  | "warehouse"
  | "farm";
export type LeadSource = "manual" | "website" | "facebook";
export type LeadStatus = "new" | "contacted" | "qualified" | "viewing" | "negotiating" | "won" | "lost";
export type LeadActivityKind = "note" | "status" | "follow_up" | "viewing" | "ai" | "inquiry";
export type Furnishing = "unfurnished" | "semi_furnished" | "fully_furnished";

type ListingDetails = {
  listing_type: ListingType;
  property_type: PropertyType;
  price_centavos: number | null;
  address: string;
  city: string;
  province: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_sqm: number | null;
  lot_area_sqm: number | null;
  parking_slots: number | null;
  furnishing: Furnishing | null;
  description: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13.0.5" };
  public: {
    Tables: {
      plans: {
        Row: {
          id: string;
          name: string;
          description: string;
          price_centavos: number;
          currency: string;
          billing_period_days: number;
          max_active_listings: number | null;
          max_leads_per_month: number | null;
          max_ai_generations_per_month: number | null;
          features: Json;
          sort_order: number;
          active: boolean;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          plan: string;
          plan_status: Database["public"]["Enums"]["plan_status"];
          plan_expires_at: string | null;
          phone: string;
          photo_path: string | null;
          slug: string;
          bio: string;
          messenger: string;
          viber: boolean;
        } & Timestamps;
        Insert: never;
        // photo_path: service role only (no column grant for agents).
        Update: {
          name?: string;
          phone?: string;
          slug?: string;
          bio?: string;
          messenger?: string;
          viber?: boolean;
          photo_path?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          agent_id: string;
          plan_id: string;
          amount_centavos: number;
          currency: string;
          provider: string;
          gcash_reference: string;
          payment_date: string;
          screenshot_path: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          submitted_at: string;
          reviewed_by: string | null;
          approved_at: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
        } & Timestamps;
        Insert: never;
        // Only the service role writes here (screenshot_path after upload).
        Update: { screenshot_path?: string | null };
        Relationships: [
          {
            foreignKeyName: "payments_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          id: boolean;
          gcash_number: string;
          gcash_account_name: string;
          payment_instructions: string;
          support_email: string;
          support_messenger_url: string;
          payment_request_ttl_days: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          link: string | null;
          dedupe_key: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          id: string;
          agent_id: string;
          title: string;
          slug: string;
          status: "active" | "archived";
        } & ListingDetails &
          Timestamps;
        Insert: { id?: string; agent_id?: string; title: string; status?: "active" | "archived" } & Partial<ListingDetails>;
        Update: { title?: string; status?: "active" | "archived" } & Partial<ListingDetails>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          agent_id: string;
          listing_id: string | null;
          name: string;
          contact: string;
          phone: string;
          email: string;
          message: string;
          source: LeadSource;
          status: LeadStatus;
          locked: boolean;
          next_follow_up_at: string | null;
          viewing_at: string | null;
          status_changed_at: string;
        } & Timestamps;
        Insert: {
          id?: string;
          agent_id?: string;
          listing_id?: string | null;
          name: string;
          contact?: string;
          phone?: string;
          email?: string;
          message?: string;
          source?: LeadSource;
          status?: LeadStatus;
        };
        Update: {
          name?: string;
          contact?: string;
          phone?: string;
          email?: string;
          status?: LeadStatus;
          next_follow_up_at?: string | null;
          viewing_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_chats: {
        Row: {
          id: string;
          listing_id: string;
          agent_id: string;
          lead_id: string | null;
          messages: Json;
          reply_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { listing_id: string; agent_id: string; messages?: Json; reply_count?: number; lead_id?: string | null };
        Update: { messages?: Json; reply_count?: number; lead_id?: string | null };
        Relationships: [];
      };
      lead_activities: {
        Row: { id: string; lead_id: string; agent_id: string; kind: LeadActivityKind; body: string; created_at: string };
        Insert: { lead_id: string; agent_id: string; kind: LeadActivityKind; body: string };
        Update: never;
        Relationships: [];
      };
      listing_photos: {
        Row: { id: string; listing_id: string; agent_id: string; path: string; position: number; created_at: string };
        Insert: { id?: string; listing_id: string; agent_id: string; path: string; position?: number };
        Update: { position?: number };
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_events: {
        Row: { id: string; agent_id: string; metric: "lead_created" | "ai_generation"; detail: string | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      get_my_entitlements: { Args: never; Returns: Json };
      get_public_listing: { Args: { p_slug: string }; Returns: Json };
      get_public_agent: { Args: { p_slug: string }; Returns: Json };
      record_listing_event: {
        Args: { p_slug: string; p_kind: string; p_channel: string; p_source: string };
        Returns: undefined;
      };
      my_listing_stats: {
        Args: { p_since: string };
        Returns: { listing_id: string; views: number; contacts: number }[];
      };
      submit_inquiry: {
        Args: { p_slug: string; p_name: string; p_phone: string; p_email: string; p_message: string; p_source: string };
        Returns: undefined;
      };
      consume_ai_generation: { Args: { p_kind: string }; Returns: number | null };
      consume_ai_generation_for: { Args: { p_agent_id: string; p_kind: string }; Returns: number | null };
      listing_has_ai_chat: { Args: { p_slug: string }; Returns: boolean | null };
      submit_payment: {
        Args: { p_plan_id: string; p_reference: string; p_payment_date: string; p_notes?: string | null };
        Returns: string;
      };
      approve_payment: { Args: { p_payment_id: string }; Returns: string };
      reject_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined };
      activate_subscription: {
        Args: { p_agent_id: string; p_plan_id: string; p_payment_id: string };
        Returns: string;
      };
      admin_set_plan: {
        Args: {
          p_agent_id: string;
          p_plan_id: string;
          p_status: Database["public"]["Enums"]["plan_status"];
          p_expires_at: string | null;
          p_note?: string | null;
        };
        Returns: undefined;
      };
      admin_set_role: {
        Args: { p_user_id: string; p_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      admin_update_settings: {
        Args: {
          p_gcash_number: string;
          p_gcash_account_name: string;
          p_payment_instructions: string;
          p_support_email: string;
          p_support_messenger_url: string;
          p_payment_request_ttl_days: number;
        };
        Returns: undefined;
      };
      admin_update_plan: {
        Args: {
          p_plan_id: string;
          p_price_centavos: number;
          p_max_active_listings: number | null;
          p_max_leads_per_month: number | null;
          p_max_ai_generations_per_month: number | null;
          p_description: string;
          p_active: boolean;
        };
        Returns: undefined;
      };
      admin_log_invite: { Args: { p_user_id: string; p_email: string; p_name: string }; Returns: undefined };
      admin_overview: { Args: never; Returns: Json };
      run_subscription_maintenance: { Args: never; Returns: Json };
    };
    Enums: {
      user_role: "agent" | "admin";
      plan_status: "active" | "pending" | "expired" | "cancelled";
      payment_status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export type Plan = Tables<"plans">;
export type Listing = Tables<"listings">;
export type Lead = Tables<"leads">;
export type LeadActivity = Tables<"lead_activities">;
export type ListingPhoto = Tables<"listing_photos">;
export type Profile = Tables<"profiles">;
export type Payment = Tables<"payments">;
export type AppSettings = Tables<"app_settings">;
export type Notification = Tables<"notifications">;
export type AuditLog = Tables<"audit_logs">;
export type PaymentStatus = Enums<"payment_status">;
export type PlanStatus = Enums<"plan_status">;
export type UserRole = Enums<"user_role">;

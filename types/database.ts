export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          created_at: string;
          name: string | null;
          description?: string | null;
          owner_id: string;
          is_published: boolean;
          slug?: string | null;
          email?: string | null;
          business_type?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_onboarding_complete: boolean;
          stripe_charges_enabled: boolean;
          stripe_payouts_enabled: boolean;
          plan?: "basic" | "free" | "inactive" | "trial" | "pro" | "elite" | "growth" | null;
          refund_policy?: string | null;
          late_fee_disclosure?: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name?: string | null;
          description?: string | null;
          owner_id: string;
          is_published?: boolean;
          slug?: string | null;
          email?: string | null;
          business_type?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_onboarding_complete?: boolean;
          stripe_charges_enabled?: boolean;
          stripe_payouts_enabled?: boolean;
          plan?: "basic" | "free" | "inactive" | "trial" | "pro" | "elite" | "growth" | null;
          refund_policy?: string | null;
          late_fee_disclosure?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string | null;
          description?: string | null;
          owner_id?: string;
          is_published?: boolean;
          slug?: string | null;
          email?: string | null;
          business_type?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_onboarding_complete?: boolean;
          stripe_charges_enabled?: boolean;
          stripe_payouts_enabled?: boolean;
          plan?: "basic" | "free" | "inactive" | "trial" | "pro" | "elite" | "growth" | null;
          refund_policy?: string | null;
          late_fee_disclosure?: string | null;
        };
      };

      legal_acceptances: {
        Row: {
          id: string;
          user_id: string;
          business_id: string;
          document_key: string;
          document_version: string;
          accepted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_id: string;
          document_key: string;
          document_version: string;
          accepted_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_id?: string;
          document_key?: string;
          document_version?: string;
          accepted_at?: string;
          created_at?: string;
        };
      };

      lead_events: {
        Row: {
          id: string;
          created_at: string;
          business_id: string;
          event_type: string;
          source?: string | null;
          conversation_id?: string | null;
          visitor_token?: string | null;
          visitor_name?: string | null;
          visitor_email?: string | null;
          visitor_phone?: string | null;
          status?: "new" | "reviewed" | "contacted" | "qualified" | "closed" | null;
          notes?: string | null;
          last_contacted_at?: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          business_id: string;
          event_type: string;
          source?: string | null;
          conversation_id?: string | null;
          visitor_token?: string | null;
          visitor_name?: string | null;
          visitor_email?: string | null;
          visitor_phone?: string | null;
          status?: "new" | "reviewed" | "contacted" | "qualified" | "closed" | null;
          notes?: string | null;
          last_contacted_at?: string | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          business_id?: string;
          event_type?: string;
          source?: string | null;
          conversation_id?: string | null;
          visitor_token?: string | null;
          visitor_name?: string | null;
          visitor_email?: string | null;
          visitor_phone?: string | null;
          status?: "new" | "reviewed" | "contacted" | "qualified" | "closed" | null;
          notes?: string | null;
          last_contacted_at?: string | null;
          metadata?: Json;
        };
      };

      property: {
        Row: {
          id: string;
          name: string;
          price: number;
          business_id: string;
          description?: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          price: number;
          business_id: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          price?: number;
          business_id?: string;
          description?: string | null;
        };
      };

      rental_availability_blocks: {
        Row: {
          id: string;
          created_at: string | null;
          business_id: string;
          property_id: string;
          start_date: string;
          end_date: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string | null;
          business_id: string;
          property_id: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string | null;
          business_id?: string;
          property_id?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
        };
      };

      rental_reservations: {
        Row: {
          id: string;
          business_id: string;
          property_id: string;
          hidden_from_ui: boolean;
          hidden_reason: string | null;
          hidden_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          fulfilled_at: string | null;
          status: string | null;
          payment_status: string | null;
          stripe_session_id: string | null;
          payment_intent_id: string | null;
          guest_name: string | null;
          guest_email: string | null;
          guest_phone: string | null;
          check_in_date: string;
          check_out_date: string;
          nights: number | null;
          amount_total: number | null;
          platform_fee: number | null;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          property_id: string;
          hidden_from_ui?: boolean;
          hidden_reason?: string | null;
          hidden_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          fulfilled_at?: string | null;
          status?: string | null;
          payment_status?: string | null;
          stripe_session_id?: string | null;
          payment_intent_id?: string | null;
          guest_name?: string | null;
          guest_email?: string | null;
          guest_phone?: string | null;
          check_in_date: string;
          check_out_date: string;
          nights?: number | null;
          amount_total?: number | null;
          platform_fee?: number | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          property_id?: string;
          hidden_from_ui?: boolean;
          hidden_reason?: string | null;
          hidden_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          fulfilled_at?: string | null;
          status?: string | null;
          payment_status?: string | null;
          stripe_session_id?: string | null;
          payment_intent_id?: string | null;
          guest_name?: string | null;
          guest_email?: string | null;
          guest_phone?: string | null;
          check_in_date?: string;
          check_out_date?: string;
          nights?: number | null;
          amount_total?: number | null;
          platform_fee?: number | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      bookings: {
        Row: {
          id: string;
          guest_name: string | null;
          guest_email: string;
          name?: string | null;
          email?: string | null;
          guest_phone?: string | null;
          cancel_token?: string | null;
          reminder_sent: boolean;
          business_id: string;
          metadata?: Json | null;
          duration_minutes?: number | null;
          booking_time?: string | null;
          date: string | null;
          start_time: string | null;
          end_time: string | null;
          customer_email: string | null;
          hidden_from_ui: boolean;
          hidden_reason: string | null;
          hidden_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          fulfilled_at: string | null;
          status: string;
          created_at: string | null;
          payment_status?: string | null;
          stripe_session_id?: string | null;
          payment_intent_id?: string | null;
          amount_total?: number | null;
          total_amount?: number | null;
          platform_fee?: number | null;
          customer_name?: string | null;
          phone: string;
          client_address?: string | null;
        };
        Insert: {
          id?: string;
          guest_name?: string | null;
          guest_email: string;
          name?: string | null;
          email?: string | null;
          guest_phone?: string | null;
          cancel_token?: string | null;
          reminder_sent: boolean;
          business_id: string;
          metadata?: Json | null;
          duration_minutes?: number | null;
          booking_time?: string | null;
          date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          customer_email?: string | null;
          hidden_from_ui?: boolean;
          hidden_reason?: string | null;
          hidden_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          fulfilled_at?: string | null;
          status: string;
          created_at?: string | null;
          payment_status?: string | null;
          stripe_session_id?: string | null;
          payment_intent_id?: string | null;
          amount_total?: number | null;
          total_amount?: number | null;
          platform_fee?: number | null;
          customer_name?: string | null;
          phone: string;
          client_address?: string | null;
        };
        Update: {
          id?: string;
          guest_name?: string | null;
          guest_email?: string;
          name?: string | null;
          email?: string | null;
          guest_phone?: string | null;
          cancel_token?: string | null;
          reminder_sent?: boolean;
          business_id?: string;
          metadata?: Json | null;
          duration_minutes?: number | null;
          booking_time?: string | null;
          date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          customer_email?: string | null;
          hidden_from_ui?: boolean;
          hidden_reason?: string | null;
          hidden_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          fulfilled_at?: string | null;
          status?: string | null;
          created_at?: string | null;
          payment_status?: string | null;
          stripe_session_id?: string | null;
          payment_intent_id?: string | null;
          amount_total?: number | null;
          total_amount?: number | null;
          platform_fee?: number | null;
          customer_name?: string | null;
          phone?: string | null;
          client_address?: string | null;
        };
      };

      pricing_rules: {
        Row: {
          id: string;
          business_id: string;
          service_id: string | null;
          day_of_week: number | null;
          start_time: string | null;
          end_time: string | null;
          active: boolean | null;
          priority: number | null;
          rule_type: string | null;
          amount: number | null;
          percentage: number | null;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          service_id?: string | null;
          day_of_week?: number | null;
          start_time?: string | null;
          end_time?: string | null;
          active?: boolean | null;
          priority?: number | null;
          rule_type?: string | null;
          amount?: number | null;
          percentage?: number | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          service_id?: string | null;
          day_of_week?: number | null;
          start_time?: string | null;
          end_time?: string | null;
          active?: boolean | null;
          priority?: number | null;
          rule_type?: string | null;
          amount?: number | null;
          percentage?: number | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      slot_pricing: {
        Row: {
          id: string;
          business_id: string;
          date: string;
          start_time: string;
          end_time: string;
          demand_score: number;
          price: number;
          price_adjustment: number;
          booking_count_30d: number;
          recent_booking_count_7d: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          date: string;
          start_time: string;
          end_time: string;
          demand_score: number;
          price: number;
          price_adjustment: number;
          booking_count_30d?: number;
          recent_booking_count_7d?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          demand_score?: number;
          price?: number;
          price_adjustment?: number;
          booking_count_30d?: number;
          recent_booking_count_7d?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      property_images: {
        Row: {
          id: string;
          image_url: string;
          property_id: string;
          business_id: string;
        };
        Insert: {
          id?: string;
          image_url: string;
          property_id: string;
          business_id: string;
        };
        Update: {
          id?: string;
          image_url?: string;
          property_id?: string;
          business_id?: string;
        };
      };

      property_content: {
        Row: {
          id: string;
          property_id: string;
          title: string;
          description: string;
          business_id: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          title: string;
          description: string;
          business_id: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          title?: string;
          description?: string;
          business_id?: string;
        };
      };

      conversations: {
        Row: {
          id: string;
          business_id: string;
          client_user_id: string | null;
          client_name: string | null;
          client_email: string | null;
          client_phone: string | null;
          owner_user_id: string | null;
          subject: string | null;
          context_type: string | null;
          context_id: string | null;
          last_message_at: string | null;
          created_at: string | null;
          updated_at: string | null;
          access_token: string | null;
          guest_token: string | null;
          booking_id: string | null;
          source: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_user_id?: string | null;
          client_name?: string | null;
          client_email?: string | null;
          client_phone?: string | null;
          owner_user_id?: string | null;
          subject?: string | null;
          context_type?: string | null;
          context_id?: string | null;
          last_message_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          access_token?: string | null;
          guest_token?: string | null;
          booking_id?: string | null;
          source?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          client_user_id?: string | null;
          client_name?: string | null;
          client_email?: string | null;
          client_phone?: string | null;
          owner_user_id?: string | null;
          subject?: string | null;
          context_type?: string | null;
          context_id?: string | null;
          last_message_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          access_token?: string | null;
          guest_token?: string | null;
          booking_id?: string | null;
          source?: string | null;
        };
      };

      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_user_id: string | null;
          recipient_user_id: string | null;
          business_id: string;
          body: string;
          is_read: boolean;
          read_at: string | null;
          created_at: string | null;
          is_deleted: boolean;
          deleted_at: string | null;
          deleted_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_user_id?: string | null;
          recipient_user_id?: string | null;
          business_id: string;
          body: string;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string | null;
          is_deleted?: boolean;
          deleted_at?: string | null;
          deleted_by_user_id?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_user_id?: string | null;
          recipient_user_id?: string | null;
          business_id?: string;
          body?: string;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string | null;
          is_deleted?: boolean;
          deleted_at?: string | null;
          deleted_by_user_id?: string | null;
        };
      };
    };
  };
}

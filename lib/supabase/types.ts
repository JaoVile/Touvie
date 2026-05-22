// Database types — placeholder until we run `supabase gen types typescript`
// against the real project. Shape here matches migrations/0001_initial_schema.sql.
// TODO(setup): replace with generated types after first deploy.

type Timestamptz = string;
type DateStr = string;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          full_name: string | null;
          telegram_chat_id: string | null;
          pin_hash: string | null;
          pin_salt: string | null;
          theme: string;
          locale: string;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          week_start: DateStr;
          content: string;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["journal_entries"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["journal_entries"]["Row"]>;
        Relationships: [];
      };
      routine_daily: {
        Row: {
          id: string;
          user_id: string;
          time_slot: string;
          title: string;
          emoji: string | null;
          notes: string | null;
          active: boolean;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["routine_daily"]["Row"],
          "id" | "created_at" | "updated_at" | "active"
        > & { id?: string; active?: boolean };
        Update: Partial<Database["public"]["Tables"]["routine_daily"]["Row"]>;
        Relationships: [];
      };
      routine_weekly: {
        Row: {
          id: string;
          user_id: string;
          weekday: number;
          block: string;
          title: string;
          emoji: string | null;
          notes: string | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["routine_weekly"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["routine_weekly"]["Row"]>;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          parent_goal_id: string | null;
          title: string;
          description: string | null;
          target_date: DateStr | null;
          status: "active" | "done" | "paused" | "dropped";
          sort_order: number;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["goals"]["Row"],
          "id" | "created_at" | "updated_at" | "status" | "sort_order"
        > & { id?: string; status?: string; sort_order?: number };
        Update: Partial<Database["public"]["Tables"]["goals"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          title: string;
          notes: string | null;
          due_date: DateStr | null;
          done: boolean;
          priority: number;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tasks"]["Row"],
          "id" | "created_at" | "updated_at" | "done" | "priority"
        > & { id?: string; done?: boolean; priority?: number };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

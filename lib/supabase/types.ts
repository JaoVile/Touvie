// Database types — escritos à mão a partir de supabase/migrations/*.
// Cobrem todas as tabelas e views do schema (até a migration 0016).
//
// Insert/Update são Partial<Row> de propósito: o objetivo é o `tsc` pegar
// nome de tabela/coluna errado (foi assim que o bug do webhook — `accounts`
// em vez de `finance_accounts` — passou batido). Não modelamos defaults
// coluna-a-coluna; pra isso, gerar com `supabase gen types` no futuro.

type Timestamptz = string;
type DateStr = string;
type TimeStr = string;
export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

// Tabela: Row tipado, Insert/Update permissivos (pegam chave inexistente).
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
// View: só leitura.
type View<Row> = {
  Row: Row;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<{
        id: string;
        display_name: string | null;
        full_name: string | null;
        telegram_chat_id: string | null;
        telegram_link_token: string | null;
        telegram_link_expires_at: Timestamptz | null;
        pin_hash: string | null;
        write_pin_hash: string | null;
        recovery_hash: string | null;
        pin_salt: string | null;
        pin_attempts: number;
        pin_locked_until: Timestamptz | null;
        theme: string;
        locale: string;
        focus_quest_enabled: boolean;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      toube_messages: Table<{
        id: string;
        user_id: string;
        session_id: string;
        role: "user" | "assistant";
        content: string;
        created_at: Timestamptz;
      }>;
      toube_sessions: Table<{
        id: string;
        user_id: string;
        title: string | null;
        summary: string | null;
        /** Migration 0039. */
        source: "web" | "telegram";
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      /** Migration 0039. Proposta aguardando confirmação por botão no Telegram. */
      toube_pending_proposals: Table<{
        id: string;
        user_id: string;
        chat_id: string;
        message_id: number | null;
        proposals: Json;
        consumed_at: Timestamptz | null;
        expires_at: Timestamptz;
        created_at: Timestamptz;
      }>;
      focus_quests: Table<{
        id: string;
        user_id: string;
        text: string;
        prompt: string;
        started_at: Timestamptz;
        completed_at: Timestamptz | null;
        created_at: Timestamptz;
      }>;
      diary_keys: Table<{
        user_id: string;
        pin_wrap: { salt: string; iv: string; ct: string } | null;
        recovery_wrap: { salt: string; iv: string; ct: string } | null;
        code_wrap: { salt: string; iv: string; ct: string } | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      journal_entries: Table<{
        id: string;
        user_id: string;
        week_start: DateStr;
        content: string;
        mood_score: number | null;
        mood_emoji: string | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      routine_daily: Table<{
        id: string;
        user_id: string;
        time_slot: TimeStr;
        title: string;
        emoji: string | null;
        notes: string | null;
        active: boolean;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      routine_weekly: Table<{
        id: string;
        user_id: string;
        weekday: number;
        block: string;
        title: string;
        emoji: string | null;
        notes: string | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      routine_completions: Table<{
        id: string;
        user_id: string;
        routine_id: string;
        completed_on: DateStr;
      }>;
      goals: Table<{
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
      }>;
      tasks: Table<{
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
      }>;
      finance_accounts: Table<{
        id: string;
        user_id: string;
        name: string;
        kind: "cash" | "checking" | "savings" | "credit" | "investment";
        balance_cents: number;
        archived: boolean;
        credit_limit_cents: number | null;
        closing_day: number | null;
        due_day: number | null;
        created_at: Timestamptz;
      }>;
      finance_categories: Table<{
        id: string;
        user_id: string;
        name: string;
        kind: "income" | "expense";
        emoji: string | null;
        color: string | null;
        archived: boolean;
      }>;
      transactions: Table<{
        id: string;
        user_id: string;
        account_id: string | null;
        category_id: string | null;
        amount_cents: number;
        kind: "income" | "expense";
        occurred_on: DateStr;
        description: string | null;
        is_recurring: boolean;
        recurrence_rule: string | null;
        reminder_enabled: boolean;
        external_ref: string | null;
        installment_total: number | null;
        installment_number: number | null;
        installment_group_id: string | null;
        bill_id: string | null;
        created_at: Timestamptz;
      }>;
      bills: Table<{
        id: string;
        user_id: string;
        title: string;
        amount_cents: number;
        due_date: DateStr;
        paid_at: Timestamptz | null;
        recurrence_rule: string | null;
        category_id: string | null;
        notes: string | null;
        created_at: Timestamptz;
      }>;
      budget_envelopes: Table<{
        id: string;
        user_id: string;
        category_id: string | null;
        month: string;
        limit_cents: number;
        name: string;
        emoji: string | null;
        color: string | null;
        created_at: Timestamptz;
      }>;
      notes: Table<{
        id: string;
        user_id: string;
        title: string;
        content: string;
        tags: string[];
        pinned: boolean;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      reading_books: Table<{
        id: string;
        user_id: string;
        title: string;
        author: string | null;
        file_path: string;
        file_name: string;
        file_size_bytes: number;
        total_pages: number | null;
        current_page: number;
        cover_path: string | null;
        last_read_at: Timestamptz | null;
        status: "unread" | "reading" | "read";
        is_favorite: boolean;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      reading_highlights: Table<{
        id: string;
        user_id: string;
        book_id: string;
        page: number;
        rects: Json;
        text: string;
        color: string;
        note: string | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      reading_page_text: Table<{
        id: string;
        user_id: string;
        book_id: string;
        page: number;
        text: string;
        source: "layer" | "ocr";
        created_at: Timestamptz;
      }>;
      notification_templates: Table<{
        id: string;
        key: string;
        name: string;
        content: string;
        is_active: boolean;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      user_reminders: Table<{
        id: string;
        user_id: string;
        area: string;
        message: string;
        schedule_type: "daily" | "weekly" | "interval" | "once";
        at_time: string | null;
        on_date: string | null;
        days: number[];
        every_hours: number | null;
        window_from: string | null;
        window_to: string | null;
        active: boolean;
        last_fired_at: Timestamptz | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
      app_logs: Table<{
        id: string;
        user_id: string | null;
        event_type: "cron" | "webhook" | "api" | "system";
        source: string;
        status: "success" | "error" | "warning";
        message_preview: string | null;
        metadata: Record<string, unknown> | null;
        created_at: Timestamptz;
      }>;
      workout_programs: Table<{
        id: string;
        user_id: string;
        name: string;
        active: boolean;
        created_at: Timestamptz;
      }>;
      workout_days: Table<{
        id: string;
        program_id: string;
        user_id: string;
        weekday: number;
        name: string;
      }>;
      workout_day_exercises: Table<{
        id: string;
        user_id: string;
        program_day_id: string;
        exercise_id: string;
        sort_order: number;
        target_sets: number | null;
        target_reps_low: number | null;
        target_reps_high: number | null;
        notes: string | null;
        created_at: Timestamptz;
      }>;
      exercises: Table<{
        id: string;
        user_id: string;
        name: string;
        muscle_group: string | null;
        notes: string | null;
      }>;
      workout_sessions: Table<{
        id: string;
        user_id: string;
        program_day_id: string | null;
        occurred_on: DateStr;
        notes: string | null;
        created_at: Timestamptz;
        /** Nulo = em andamento. Migration 0038. */
        completed_at: Timestamptz | null;
      }>;
      exercise_logs: Table<{
        id: string;
        user_id: string;
        session_id: string;
        exercise_id: string;
        set_number: number;
        reps: number | null;
        weight_kg: number | null;
        rpe: number | null;
      }>;
      foods: Table<{
        id: string;
        user_id: string;
        name: string;
        kcal_per_100g: number;
        protein_g: number;
        carb_g: number;
        fat_g: number;
        fiber_g: number;
        serving_g: number | null;
      }>;
      meals: Table<{
        id: string;
        user_id: string;
        occurred_on: DateStr;
        meal_type: "breakfast" | "lunch" | "snack" | "dinner" | "pre" | "post" | "other";
        notes: string | null;
      }>;
      meal_items: Table<{
        id: string;
        user_id: string;
        meal_id: string;
        food_id: string;
        grams: number;
      }>;
      body_measurements: Table<{
        id: string;
        user_id: string;
        measured_on: DateStr;
        weight_kg: number | null;
        waist_cm: number | null;
        chest_cm: number | null;
        arm_cm: number | null;
        thigh_cm: number | null;
        bodyfat_pct: number | null;
        notes: string | null;
      }>;
      workout_program_drafts: Table<{
        id: string;
        user_id: string;
        plan: Json;
        source_kind: string | null;
        status: "building" | "committed";
        created_program_id: string | null;
        created_at: Timestamptz;
        updated_at: Timestamptz;
      }>;
    };
    Views: {
      finance_account_balances: View<{
        account_id: string;
        user_id: string;
        current_cents: number;
      }>;
      personal_records: View<{
        user_id: string;
        exercise_id: string;
        exercise_name: string;
        muscle_group: string | null;
        best_1rm: number | null;
        best_weight: number | null;
        total_sets: number;
        last_logged_on: DateStr | null;
      }>;
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

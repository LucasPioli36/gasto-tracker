import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; username: string; name: string; password_hash: string; salary: number; savings_goal: number; created_at: string }
        Insert: { username: string; name: string; password_hash: string; salary?: number; savings_goal?: number }
        Update: { salary?: number; savings_goal?: number; name?: string }
        Relationships: []
      }
      couple: {
        Row: { id: string; user1_id: string; user2_id: string; monthly_budget: number; created_at: string }
        Insert: { user1_id: string; user2_id: string; monthly_budget?: number }
        Update: { monthly_budget?: number }
        Relationships: []
      }
      expenses: {
        Row: { id: string; user_id: string | null; couple_id: string | null; created_by: string | null; amount: number; category: string; description: string | null; date: string; created_at: string; is_income: boolean }
        Insert: { user_id?: string | null; couple_id?: string | null; created_by?: string | null; amount: number; category: string; description?: string | null; date?: string; is_income?: boolean }
        Update: { user_id?: string | null; couple_id?: string | null; created_by?: string | null; amount?: number; category?: string; description?: string | null; date?: string; is_income?: boolean }
        Relationships: []
      }
      investment_portfolios: {
        Row: { user_id: string; initial_invested_usd: number; initial_gain_usd: number; initial_date: string; units_owned: number; units_initialized: boolean; created_at: string; updated_at: string }
        Insert: { user_id: string; initial_invested_usd: number; initial_gain_usd: number; initial_date: string; units_owned?: number; units_initialized?: boolean; updated_at?: string }
        Update: { initial_invested_usd?: number; initial_gain_usd?: number; initial_date?: string; units_owned?: number; units_initialized?: boolean; updated_at?: string }
        Relationships: []
      }
      investment_purchases: {
        Row: { id: string; user_id: string; amount_usd: number; purchase_date: string; price_usd: number; units_added: number; created_at: string }
        Insert: { user_id: string; amount_usd: number; purchase_date: string; price_usd: number; units_added: number }
        Update: { amount_usd?: number; purchase_date?: string; price_usd?: number; units_added?: number }
        Relationships: []
      }
      investment_price_snapshots: {
        Row: { id: string; symbol: string; price_usd: number; trade_at: string; fetched_at: string; trading_date: string; source: string }
        Insert: { symbol?: string; price_usd: number; trade_at: string; fetched_at?: string; trading_date: string; source?: string }
        Update: { price_usd?: number; trade_at?: string; fetched_at?: string; trading_date?: string; source?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      add_cspx_purchase: { Args: { p_user_id: string; p_amount: number; p_purchase_date: string }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

let _db: SupabaseClient<Database> | null = null

export function getDb(): SupabaseClient<Database> {
  if (!_db) {
    const url = process.env.SUPABASE_URL?.replace(/^﻿/, '')
    const key = process.env.SUPABASE_SERVICE_KEY?.replace(/^﻿/, '')
    if (!url || !key) throw new Error('Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_KEY required')
    _db = createClient<Database>(url, key)
  }
  return _db
}

export const db = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type User = Database['public']['Tables']['users']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type Couple = Database['public']['Tables']['couple']['Row']

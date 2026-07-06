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
        Row: { id: string; user_id: string | null; couple_id: string | null; amount: number; category: string; description: string | null; date: string; created_at: string }
        Insert: { user_id?: string | null; couple_id?: string | null; amount: number; category: string; description?: string | null; date?: string }
        Update: { amount?: number; category?: string; description?: string | null }
        Relationships: []
      }
      couple_deposits: {
        Row: { id: string; couple_id: string; user_id: string; amount: number; date: string; created_at: string }
        Insert: { couple_id: string; user_id: string; amount: number; date?: string }
        Update: { amount?: number }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

let _db: SupabaseClient<Database> | null = null

export function getDb(): SupabaseClient<Database> {
  if (!_db) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
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
export type Deposit = Database['public']['Tables']['couple_deposits']['Row'] & { users?: { name: string } }

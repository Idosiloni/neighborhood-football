import { createSupabaseApi } from './supabaseApi'
import { createMockApi } from './mockApi'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// With Supabase keys → shared live data. Without → a local demo in this browser only,
// which a real deployment must never fall back to (App shows a "not configured" screen).
export const notConfigured = import.meta.env.PROD && !(url && key)
export const api = url && key ? createSupabaseApi(url, key) : createMockApi()

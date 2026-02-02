import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iezxmhrjndzuckjcxihd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllenhtaHJqbmR6dWNramN4aWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMTU3NzgsImV4cCI6MjA3MzY5MTc3OH0.uF8jD4PriVu3eb4UJUw2FqOqF9CiCAJtq4M-FIdBXik';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface FaturamentoRow {
  id?: number;
  empresa: string;
  data: string; // YYYY-MM-DD
  valor: number;
  created_at?: string;
  updated_at?: string;
}

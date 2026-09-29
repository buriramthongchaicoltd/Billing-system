import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName?: string;
  autoSync: boolean;
}

const STORAGE_KEY = 'recon_supabase_config_v1';

export function getSavedSupabaseConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(e);
  }
  return {
    url: '',
    anonKey: '',
    tableName: 'bills_buffer',
    autoSync: false
  };
}

export function saveSupabaseConfig(cfg: SupabaseConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

let cachedClient: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSavedSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) return null;

  if (cachedClient && currentUrl === cfg.url && currentKey === cfg.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(cfg.url, cfg.anonKey);
    currentUrl = cfg.url;
    currentKey = cfg.anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jzmcqznzcovthjhpxoda.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_alMZV8cOMfiJI_zBJezZvQ_w7LwO3eE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

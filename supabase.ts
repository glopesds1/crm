import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nlvjlgjztngiixcpumfe.supabase.co';
const supabaseKey = 'sb_publishable_8GYm9Gs9VLyYHJgc3oZgmw_GyXrbOXj';

export const supabase = createClient(supabaseUrl, supabaseKey);

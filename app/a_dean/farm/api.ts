import { db } from '@/lib/Supabase/supabaseClient'
import { toast } from 'sonner';

export async function getFarms() {
  try {
    const { data, error } = await db
      .from('farms')
      .select('*')
      .eq('void', 0)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching farms:', error.message);
    }

    return data;
  } catch (error) {
    toast("Failed to fetch farms,check your connection and please try again.");
    console.error('Unexpected error fetching farms:', error);
  }
}

export async function getFarmById(id: number) {
  const { data, error } = await db
    .from('farms')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
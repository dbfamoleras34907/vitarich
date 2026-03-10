


// lib/db/users.ts
import { db } from '@/lib/Supabase/supabaseClient'
import { Customer, SuperUsers, UserInsert, UserRow } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'

export async function insertUser(user: Omit<Customer, 'id' | 'created_at'>) {
  const { data, error } = await db
    .from('users')
    .insert(user)
    .select()
    .single()

  if (error) throw error
  return data as Customer
}



export async function updateUser(id: number, updates: Partial<Customer>) {
  const { data, error } = await db
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Customer
}





export async function GetUsers(params?: Partial<Customer>) {
  let query = db.from('users').select('*')

  // if (params) {
  //   for (const [key, value] of Object.entries(params)) {
  //     if (value !== undefined && value !== null && value !== '') {
  //       query = query.ilike(key, `%${value}%`)
  //     }
  //   }
  // }

  const { data, error } = await query.order('id', { ascending: true })
  console.log({ data, error })
  if (error) throw new Error(error.message)
  return data
}


export async function GETAuthUsers() {
  // Use Service Role Key here (NOT the anon key)

  console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('SERVICE ROLE KEY:', process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ? 'loaded' : 'missing')



  const admin_ = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY! // Must be the service role key
  )

  const { data, error } = await admin_.auth.admin.listUsers()

  if (error) {
    console.error(error)
    return Response.json({ error: error.message }, { status: error.status || 500 })
  }

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
  }))

  return Response.json(users)
}


export async function upsertUserProfile(userProfileData: UserInsert): Promise<UserRow> {
  const payload = {
    ...userProfileData,
    updated_at: new Date().toISOString(),
  };
  console.log({ payload })
  const { data, error } = await db
    .from('users')
    .upsert(payload, {
      onConflict: 'auth_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase Upsert Error:', error);
    throw new Error(error.message);
  }
  return data as UserRow;
}

export async function insertUserProfile(userProfileData: UserInsert): Promise<UserRow> {
  const payload = {
    ...userProfileData,
    updated_at: new Date().toISOString(),
  };

  console.log({ payload });

  const { data, error } = await db
    .from('users')
    .insert(payload) // Changed from .upsert()
    .select()
    .single();

  if (error) {
    console.error('Supabase Insert Error:', error);
    throw new Error(error.message);
  }

  return data as UserRow;
}

export async function updateUserProfile(userProfileData: UserInsert) {
  const payload = {
    ...userProfileData,
    updated_at: new Date().toISOString(),
  };
  console.log(payload)
  const { data, error } = await db
    .from('users')
    .update(payload)
    .eq('auth_id', userProfileData.auth_id)
    .select()
    .single();
  console.log({ data, error })
  if (error) {
    console.error('Supabase Update Error:', error);
    throw new Error(error.message);
  }

  // return data as UserRow;
}

export async function getProfileByAuthId(authId: string): Promise<UserRow | null> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is 'No rows found'
    console.error('Supabase Select Error:', error);
    throw new Error(error.message);
  }

  // Returns the profile data or null if not found
  return data as UserRow | null;
}



export async function getProfileNotByAuthIdIsSuper(authId: string) {
  const { data, error } = await db
    .from('vwdmf_super_users')
    .select(`*`)
    .neq('auth_id', authId);
  if (error) {
    console.error('Supabase Select Error:', error);
    throw new Error(error.message);
  }

  return data ;
}


export async function GetUserList() {
  const { data, error } = await db
    .from('users')
    .select('*')

  console.log({ data, error })
  // .order('posting_date', { ascending: false })

  if (error) {
    throw error
  }
  console.log({ data })
  return data as UserRow[]
}

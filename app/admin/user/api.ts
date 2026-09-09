


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
  const query = db.from('users').select('*')

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

// export async function updateUserProfile(userProfileData: UserInsert) {
//   const payload = {
//     ...userProfileData,
//     updated_at: new Date().toISOString(),
//   };
//   console.log(payload)
//   const { data, error } = await db
//     .from('users')
//     .update(payload)
//     .eq('auth_id', userProfileData.auth_id)
//     .select()
//     .single();
//   console.log({ data, error })
//   if (error) {
//     console.error('Supabase Update Error:', error);
//     throw new Error(error.message);
//   }

//   // return data as UserRow;
// }

export async function updateUserProfile(
  userProfileData: UserInsert,
  defaultFarms: string[] = []
) {
  const { data: sessionData } = await db.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Authentication required.')
  const response = await fetch('/api/admin/updateUserProfile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      userProfileData,
      defaultFarms,
    }),
  })

  const result = await response.json() as {
    activeFarmCodes?: string[]
    error?: string
  }

  if (!response.ok) {
    throw new Error(result.error || 'Unable to update user profile.')
  }

  return result
}


export async function signupUser(
  userProfileData: UserInsert
) {

  console.log({ userProfileData });

  const payload = {
    p_auth_id: userProfileData.auth_id,
    p_email: userProfileData.email,
    p_firstname: userProfileData.firstname,
    p_middlename: userProfileData.middlename,
    p_lastname: userProfileData.lastname,
    p_gender: userProfileData.gender,
    p_birthdate: userProfileData.birthdate,
    p_location: userProfileData.location,
    p_updated_by: userProfileData.created_by,
  };

  const { error } = await db.rpc(
    'dmffn_insert_user_profile',
    payload
  );

  if (error) {
    console.error('Supabase RPC Error:', error);
    throw new Error(error.message);
  }
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



// export async function getProfileNotByAuthIdIsSuper(authId: string) {
//   const { data, error } = await db
//     .from('vwdmf_super_users')
//     .select(`*`)
//     .neq('auth_id', authId);
//   if (error) {
//     console.error('Supabase Select Error:', error);
//     throw new Error(error.message);
//   }

//   return data ;
// }


export async function getUserInfoById(authId: string | number) {
  const { data, error } = await db
    .from('users')
    .select(`*`)
    .eq('id', authId)
    .maybeSingle();
  if (error) {
    console.error('Supabase Select Error:', error);
    throw new Error(error.message);
  }
  console.log({ authId })

  if (!data?.id) return [];

  const users_farms = await getUserFarmCodesByUserId(data.id);

  return [{
    ...data,
    users_farms,
  }];
}

export async function getUserFarmCodesByUserId(userId: string | number) {
  const { data, error } = await db
    .from('users_farms')
    .select('farm_code')
    .eq('users_id', userId)
    .eq('void', 1)

  if (error) {
    console.error('Supabase User Farms Select Error:', error)
    throw new Error(error.message)
  }

  return (data ?? [])
    .map((row) => String(row.farm_code ?? '').trim())
    .filter(Boolean)
}

export async function getUserInfoAuthSession() {
  const { data: { session },
  } = await db.auth.getSession();
  const { data, error } = await db
    .from('users')
    .select(`*`)
    .eq('auth_id', session?.user.id)
    .maybeSingle();
  if (error) {
    console.error('Supabase Select Error:', error);
    throw new Error(error.message);
  }

  if (!data?.id) return [];

  const users_farms = await getUserFarmCodesByUserId(data.id);

  return [{
    ...data,
    users_farms,
  }];
}


export async function GetUserList() {
  const { data: sessionData } = await db.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Authentication required.')

  const response = await fetch('/api/admin/getUser', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const result = await response.json() as { user?: UserRow[]; error?: string }
  if (!response.ok) throw new Error(result.error || 'Unable to load users.')
  return result.user ?? []
}

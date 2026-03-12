import { admin_db } from "@/lib/Supabase/supabaseAdmin"
import { db } from "@/lib/Supabase/supabaseClient"
import { decryptValue } from "@/lib/decrypt"


// export async function getApprovalRequests() {
//   const { data, error } = await db
//     .from("approval_requests")
//     .select(`
//       id,
//       created_at,
//       user_email,
//       request_type,
//       remarks,
//       status
//     `)
//     .eq("status", "pending")
//     .order("created_at", { ascending: false })

//   if (error) throw error

//   return data
// }



export async function getApprovalRequests() {
  const {
    data: { session },
    error: sessionError,
  } = await db.auth.getSession()

  if (sessionError || !session) {
    console.error("No active session")
    return []
  }

  const authId = session.user.id

  const { data, error } = await db.rpc(
    "dmffn_get_subordinate_approval_requests",
    {
      auth_uuid: authId,
    }
  )

  if (error) {
    console.error({ error })
    return []
  }

  return data
}



// export async function approvePasswordReset(requestId: number, approvedBy: number) {

//   const { data: request, error } = await db
//     .from("approval_requests")
//     .select("*")
//     .eq("id", requestId)
//     .single()

//   if (error) throw error
//   if (!request) throw new Error("Request not found")
//   console.log(request.value_encrypted)
//   const password = decryptValue(request.value_encrypted)
//   console.log({ password })
//   const { data: userRow, error: userError } = await db
//     .from("users")
//     .select("auth_id")
//     .eq("email", request.user_email)
//     .single()

//   if (userError) throw userError
//   if (!userRow) throw new Error("User not found")
//   console.log(48)
//   const authId = userRow.auth_id

//   await admin_db.auth.admin.updateUserById(authId, {
//     password
//   })
//   console.log(54)

//   const { error: updateError } = await db
//     .from("approval_requests")
//     .update({
//       status: "approved",
//       approved_by: approvedBy,
//       approved_at: new Date()
//     })
//     .eq("id", requestId)

//   if (updateError) throw updateError

//   return true
// }


export async function rejectApproval(requestId: number, approvedBy: number) {

  const { error } = await db
    .from("approval_requests")
    .update({
      status: "rejected",
      approved_by: approvedBy,
      approved_at: new Date()
    })
    .eq("id", requestId)

  if (error) throw error

  return true
}
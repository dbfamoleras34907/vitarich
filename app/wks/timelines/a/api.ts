import { getUserInfoAuthSession } from "@/app/admin/user/api";
import { getUsersGroupById } from "@/app/admin/user-group/api";
import {
  getWorkspaceEmailRecipientUsers,
  getWorkspaceSupervisorUsers,
  getWorkspaceTimesheetReportForUser,
  getWorkspaceTimesheetSettings,
} from "@/lib/data/repositories/workspace";
import { toast } from "sonner";

function fullName(user: {
  firstname?: string | null
  middlename?: string | null
  lastname?: string | null
}) {
  return [user.firstname, user.middlename, user.lastname]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export const getTimesheets = async () => {
  try {

    const user = await getUserInfoAuthSession();
    return await getWorkspaceTimesheetReportForUser(user[0].id)
  } catch {
    toast.error("An error has occurred while fetching the data")
  }

  return []


}

export const getTimesheetEmailContext = async () => {
  const users = await getUserInfoAuthSession()
  const employee = users[0]

  if (!employee?.id) throw new Error('Unable to resolve the timesheet sender')

  const groupId = Number(employee.users_group_id)
  const [settings, supervisors, emailRecipients, group] = await Promise.all([
    getWorkspaceTimesheetSettings(),
    getWorkspaceSupervisorUsers(),
    getWorkspaceEmailRecipientUsers(),
    groupId
      ? getUsersGroupById(groupId).catch(() => null)
      : Promise.resolve(null),
  ])
  const supervisor = supervisors.find(user => user.id === settings.supervisor_user_id)
  const selectedCcUserIds = new Set((settings.default_cc_user_ids ?? []).map(Number))
  const ccEmails = new Set<string>()
  const ccRecipients = emailRecipients.flatMap(user => {
    const email = user.email.trim().toLowerCase()
    if (
      !selectedCcUserIds.has(user.id) ||
      user.id === settings.supervisor_user_id ||
      ccEmails.has(email)
    ) return []

    ccEmails.add(email)
    return [{
      id: user.id,
      name: fullName(user) || user.email,
      email,
    }]
  })

  return {
    employeeName: fullName(employee) || employee.email || `User #${employee.id}`,
    groupName: group?.group_name?.trim() || 'No user group',
    supervisorName: supervisor ? fullName(supervisor) : '',
    supervisorEmail: settings.supervisor_email?.trim() || '',
    ccRecipients,
  }
}

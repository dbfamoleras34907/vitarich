/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Building2, Check, ShieldCheck, UserRound } from 'lucide-react'

import { useGlobalContext } from '@/lib/context/GlobalContext'
import { db } from '@/lib/Supabase/supabaseClient'

import {
  updateUserProfile,
  getProfileByAuthId,
  getUserFarmCodesByUserId,
  getUserInfoAuthSession,
} from '../api'

import { User } from '@supabase/supabase-js'
import { SuperUsers, UserInsert, UserRow } from '@/lib/types'

import SearchableDropdown from '@/lib/SearchableDropdown'
import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'

import { DefaultGenders, islandGrouplist, regionList } from '@/lib/Defaults/DefaultValues'

import {
  get_vwdmf_super_users,
  getvwdmf_get_farmlist_code_name_farmtype,
} from './api'
import { getUsersGroups } from '../../user-group/api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Permissions from './Permesions'

type FarmOption = {
  code: string
  name: string
  [key: string]: unknown
}

type UserGroupOption = {
  code: string
  name: string
}

const normalizeFarmCode = (value: unknown) => String(value ?? '').trim()

const FMS_TYPES = [
  { code: 'Broiler', name: 'Broiler' },
  { code: 'Breeder', name: 'Breeder' },
  { code: 'Hatchery', name: 'Hatchery' },
]

const uniqueFarmCodes = (values: unknown[]) => {
  const seen = new Set<string>()

  return values.reduce<string[]>((result, value) => {
    const code = normalizeFarmCode(value)
    if (!code || seen.has(code)) return result

    seen.add(code)
    result.push(code)
    return result
  }, [])
}

const uniqueFarmOptions = (farms: FarmOption[]) => {
  const seen = new Set<string>()

  return farms.reduce<FarmOption[]>((result, farm) => {
    const code = normalizeFarmCode(farm.code)
    if (!code || seen.has(code)) return result

    seen.add(code)
    result.push({
      ...farm,
      code,
      name: String(farm.name ?? code),
    })
    return result
  }, [])
}

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type AuthUser = {
  email: string
  id: string | number
  auth_id: string
}

/* -------------------------------------------------------------------------- */
/*                                  COMPONENT                                 */
/* -------------------------------------------------------------------------- */

export default function Layout() {
  const { getValue, setValue } = useGlobalContext()

  const [tab, setTab] = useState('account')

  const [form, setForm] = useState<Partial<UserRow>>({})
  const [authSelected, setAuthSelected] = useState<AuthUser>()

  const [farmList, setFarmList] = useState<FarmOption[]>([])
  const [defaultFarms, setDefaultFarms] = useState<string[]>([])

  const [superUsers, setSuperUsers] = useState<SuperUsers[]>([])
  const [userGroups, setUserGroups] = useState<UserGroupOption[]>([])

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null)

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  /* -------------------------------------------------------------------------- */
  /*                               FIELD CONFIG                                 */
  /* -------------------------------------------------------------------------- */

  const fields = [
    { required: true, key: 'firstname', label: 'First Name' },
    { required: false, key: 'middlename', label: 'Middle Name' },
    { required: true, key: 'lastname', label: 'Last Name' },
    { required: false, key: 'mobile', label: 'Mobile' },
    { required: true, key: 'birthdate', label: 'Birthdate', type: 'date' },
    {
      required: false,
      key: 'gender',
      label: 'Gender',
      type: 'list',
      list: DefaultGenders,
      code: 'code',
      name: 'name',
    },
    { required: false, key: 'phone', label: 'Phone' },
    { required: true, key: 'location', label: 'Address' },
    {
      required: true,
      key: 'region',
      label: 'Region',
      type: 'list',
      list: regionList,
      code: 'code',
      name: 'name',
    },
    {
      required: true,
      key: 'archipelago',
      label: 'Island Group',
      type: 'list',
      list: islandGrouplist,
      code: 'code',
      name: 'name',
    },
    {
      required: false,
      key: 'fms_type',
      label: 'FMS Type',
      type: 'list',
      list: FMS_TYPES,
      code: 'code',
      name: 'name',
      showNameOnly: true,
    },
    {
      required: true,
      key: 'default_farm',
      label: 'Default Farm',
      type: 'list',
      list: farmList,
      code: 'code',
      name: 'name',
    },
    {
      required: true,
      key: 'assigned_farms',
      label: 'Assigned Farms',
      type: 'multi-select',
      list: farmList,
      code: 'code',
      name: 'name',
    },
    {
      required: true,
      key: 'supervisor',
      label: 'Supervisor',
      type: 'list',
      list: superUsers,
      code: 'code',
      name: 'name',
    },
    {
      required: false,
      key: 'users_group_id',
      label: 'User Group',
      type: 'list',
      list: userGroups,
      code: 'code',
      name: 'name',
      showNameOnly: true,
    },
    {
      required: false,
      key: 'issuper',
      label: 'Is Supervisor',
      type: 'switch',
    },
    {
      required: true,
      key: 'remarks',
      label: 'Remarks',
      component: 'textarea',
    },
  ]

  const fieldMap = fields.reduce<Record<string, typeof fields[number]>>((map, field) => {
    map[field.key] = field
    return map
  }, {})

  const sections = [
    {
      title: 'Identity',
      icon: UserRound,
      fields: ['firstname', 'middlename', 'lastname', 'birthdate', 'gender'],
    },
    {
      title: 'Contact',
      icon: Building2,
      fields: ['mobile', 'phone', 'location', 'region', 'archipelago'],
    },
    {
      title: 'Access',
      icon: ShieldCheck,
      fields: ['fms_type', 'default_farm', 'assigned_farms', 'supervisor', 'users_group_id', 'issuper', 'remarks'],
    },
  ]

  /* -------------------------------------------------------------------------- */
  /*                                FORM LOGIC                                  */
  /* -------------------------------------------------------------------------- */

  const handleChange = useCallback(
    (key: keyof UserInsert, value: any) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const handleSubmit = async () => {
    if (!loggedInUser?.id)
      return toast.error('Administrator not authenticated')

    if (!authSelected?.id)
      return toast.error('No user selected')

    if (tab !== 'account')
      return toast.warning("Go to 'Account' tab to save")

    try {
      setLoading(true)
      console.log({ form })
      const selectedFarmCodes = uniqueFarmCodes(defaultFarms)

      const result = await updateUserProfile(
        {
          ...form,
          auth_id: authSelected.auth_id,
          created_by: loggedInUser.id,
          issuper: form.issuper === '1' ? '1' : '0',
        } as UserInsert,
        selectedFarmCodes
      )

      await loadSuperUserData(String(authSelected.id))

      if (Array.isArray(result.activeFarmCodes)) {
        setDefaultFarms(uniqueFarmCodes(result.activeFarmCodes))
      }

      if (authSelected.auth_id === loggedInUser.id) {
        const sessionUserInfo = await getUserInfoAuthSession()
        setValue('UserInfoAuthSession', sessionUserInfo)
      }

      toast.success(
        `Profile for ${authSelected.email} saved successfully`
      )
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                              DATA LOADERS                                  */
  /* -------------------------------------------------------------------------- */

  const fetchProfile = async (authId: string) => {
    try {
      setInitialLoading(true)

      const profile = await getProfileByAuthId(authId)

      setForm({
        ...profile,
        issuper: profile?.issuper === '1' ? '1' : '0',
        supervisor: profile?.supervisor
          ? String(profile.supervisor)
          : '',
        users_group_id: profile?.users_group_id
          ? String(profile.users_group_id)
          : '',
      })
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setInitialLoading(false)
    }
  }

  const loadSuperUserData = async (userId: string | number) => {
    try {
      const [userFarmCodes, superUsersList] = await Promise.all([
        getUserFarmCodesByUserId(userId),
        get_vwdmf_super_users(),
      ])
      console.log({ userFarmCodes, superUsersList })
      setSuperUsers(superUsersList)
      setDefaultFarms(uniqueFarmCodes(userFarmCodes))
    } catch {
      toast.error('Failed loading supervisor data')
    }
  }

  const togglePermissions = (enable: boolean) => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      '#permissions-container .permission-checkbox'
    )

    let changed = 0

    checkboxes.forEach((checkbox) => {
      if (checkbox.checked !== enable) {
        checkbox.click()
        changed++
      }
    })

    toast.success(
      changed
        ? `${enable ? 'Enabled' : 'Disabled'} ${changed} permissions`
        : `All permissions already ${enable ? 'enabled' : 'disabled'
        }`
    )
  }

  /* -------------------------------------------------------------------------- */
  /*                                 EFFECTS                                    */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    setValue('loading_g', loading || initialLoading)
  }, [loading, initialLoading, setValue])

  useEffect(() => {
    const init = async () => {
      const { data } = await db.auth.getSession()
      setLoggedInUser(data.session?.user ?? null)

      const farms =
        await getvwdmf_get_farmlist_code_name_farmtype()
      const groups = await getUsersGroups()

      setFarmList(uniqueFarmOptions(farms))
      setUserGroups(groups.map(group => ({
        code: String(group.id ?? ''),
        name: group.group_name,
      })))
    }

    init()
  }, [])

  useEffect(() => {
    setAuthSelected(getValue('selectedUser'))
  }, [getValue])

  useEffect(() => {
    if (!authSelected?.auth_id) return

    fetchProfile(authSelected.auth_id)
    loadSuperUserData(authSelected.id)
  }, [authSelected])

  /* -------------------------------------------------------------------------- */
  /*                                  UI STATE                                  */
  /* -------------------------------------------------------------------------- */

  const disabled =
    loading || initialLoading || tab !== 'account' || !authSelected?.id

  const renderField = (field: typeof fields[number]) => {
    const value = (form as any)[field.key] || ''
    let control: ReactNode

    if (field.component === 'textarea') {
      control = (
        <Textarea
          className="min-h-24 border border-stone-300 bg-[#fffdfb] text-sm shadow-none focus-visible:ring-2 focus-visible:ring-stone-200"
          value={value}
          onChange={(e) => handleChange(field.key as any, e.target.value)}
        />
      )
    } else if (field.type === 'switch') {
      control = (
        <div className="flex h-10 items-center rounded-md border border-stone-300 bg-[#fffdfb] px-3">
          <Switch
            id={field.key}
            checked={value === '1'}
            onCheckedChange={(checked) =>
              handleChange(field.key as any, checked ? '1' : '0')
            }
          />
        </div>
      )
    } else if (field.type === 'list') {
      control = (
        <SearchableDropdown
          list={(field.list || []) as Record<string, unknown>[]}
          codeLabel={(field.code || '') as keyof Record<string, unknown>}
          nameLabel={(field.name || '') as keyof Record<string, unknown>}
          value={value}
          placeholder={field.label}
          showNameOnly={Boolean(field.showNameOnly)}
          onChange={(v) => handleChange(field.key as any, v)}
        />
      )
    } else if (field.type === 'multi-select') {
      control = (
        <SearchableCombobox
          required
          multiple
          showCode
          items={(field.list || []) as ComboboxItemType[]}
          value={defaultFarms}
          placeholder="Search farms..."
          onValueChange={(values) => setDefaultFarms(uniqueFarmCodes(values))}
          className="w-full"
        />
      )
    } else {
      control = (
        <Input
          type={field.type || 'text'}
          value={value}
          onChange={(e) => handleChange(field.key as any, e.target.value)}
        />
      )
    }

    return (
      <div className="grid gap-1.5">
        <Label required={field.required} className="text-xs font-medium text-stone-600">
          {field.label}
        </Label>
        {control}
      </div>
    )
  }

  /* -------------------------------------------------------------------------- */
  /*                                  RENDER                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#f7f5f1] px-3 py-4 text-stone-900 sm:px-5">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-stone-900">
              {authSelected?.email || 'No User Selected'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tab === 'Permissions' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => togglePermissions(true)}
                >
                  Allow All
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => togglePermissions(false)}
                >
                  Remove All
                </Button>
              </>
            )}

            <Button size="sm" disabled={disabled} onClick={handleSubmit}>
              <Check className="size-4" />
              {initialLoading
                ? 'Loading...'
                : loading
                  ? 'Saving...'
                  : 'Save'}
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="gap-0">
          <div className="border-b border-stone-200 px-4 pt-3">
            <TabsList variant="line" className="h-9">
              <TabsTrigger value="account" className="px-3">Account</TabsTrigger>
              <TabsTrigger value="Permissions" className="px-3">Permissions</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="account" className="m-0">
            <form className="p-4">
              <div className="space-y-5">
                {sections.map((section) => {
                  const Icon = section.icon

                  return (
                    <section key={section.title} className="rounded-md border border-stone-200">
                      <div className="flex items-center gap-2 border-b border-stone-200 bg-[#faf9f6] px-3 py-2">
                        <Icon className="size-4 text-stone-500" />
                        <h2 className="text-sm font-semibold text-stone-800">
                          {section.title}
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
                        {section.fields.map((key) => {
                          const field = fieldMap[key]
                          if (!field) return null

                          return (
                            <div
                              key={field.key}
                              className={field.component === 'textarea' || field.key === 'assigned_farms'
                                ? 'md:col-span-2'
                                : ''}
                            >
                              {renderField(field)}
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </form>
          </TabsContent>

          <TabsContent value="Permissions" className="m-0 p-4">
            <Permissions userId={authSelected?.auth_id || '0'} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

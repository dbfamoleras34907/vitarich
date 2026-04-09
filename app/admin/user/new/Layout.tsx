/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

import { useGlobalContext } from '@/lib/context/GlobalContext'
import { db } from '@/lib/Supabase/supabaseClient'

import {
  updateUserProfile,
  getProfileByAuthId,
  getUserInfoById,
} from '../api'

import { User } from '@supabase/supabase-js'
import { SuperUsers, UserInsert, UserRow } from '@/lib/types'

import SuperUser from './SuperUser'
import RuleAndPerm from './RuleAndPerm'

import SearchableDropdown from '@/lib/SearchableDropdown'
import SearchableCombobox from '@/components/SearchableCombobox'

import { DefaultGenders } from '@/lib/Defaults/DefaultValues'
import { ColumnsYesOrNoCodeOnly } from '@/lib/Defaults/DefaultColumns'

import {
  get_vwdmf_super_users,
  getvwdmf_get_farmlist_code_name_farmtype,
} from './api'
import DefaultFarmComboBox from '@/app/components/DefaultFarmComboBox'

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type AuthUser = {
  email: string
  id: string
  auth_id: string
}

/* -------------------------------------------------------------------------- */
/*                                  COMPONENT                                 */
/* -------------------------------------------------------------------------- */

export default function Layout() {
  const [farm, setFarm] = useState()
  const { getValue, setValue } = useGlobalContext()

  const [tab, setTab] = useState(1)

  const [form, setForm] = useState<Partial<UserRow>>({})
  const [authSelected, setAuthSelected] = useState<AuthUser>()

  const [farmList, setFarmList] = useState<any[]>([])
  const [defaultFarms, setDefaultFarms] = useState<any[]>([])

  const [superUsers, setSuperUsers] = useState<SuperUsers[]>([])

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
      required: true,
      key: 'remarks',
      label: 'Remarks',
      component: 'textarea',
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

    if (tab !== 1)
      return toast.warning("Go to 'Details' tab to save")

    try {
      setLoading(true)

      await updateUserProfile(
        {
          ...form,
          auth_id: authSelected.auth_id,
          created_by: loggedInUser.id,
        } as UserInsert,
        defaultFarms
      )

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
        supervisor: profile?.supervisor
          ? String(profile.supervisor)
          : '',
      })
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setInitialLoading(false)
    }
  }

  const loadSuperUserData = async (userId: string) => {
    try {
      const [userInfo, superUsersList] = await Promise.all([
        getUserInfoById(userId),
        get_vwdmf_super_users(),
      ])

      setSuperUsers(superUsersList)
      setDefaultFarms(userInfo?.[0]?.users_farms ?? [])
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

      setFarmList(farms)
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
    loading || initialLoading || tab !== 1 || !authSelected?.id

  /* -------------------------------------------------------------------------- */
  /*                                  RENDER                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div>
      {/* HEADER */}
      <div className="px-4 my-2 flex justify-between">
        <p className="font-bold text-xl">
          {authSelected?.email || 'No User Selected'}
        </p>

        <div className="flex gap-2">
          {tab === 2 && (
            <>
              <Button
                variant="secondary"
                onClick={() => togglePermissions(true)}
              >
                Allow All
              </Button>

              <Button
                variant="destructive"
                onClick={() => togglePermissions(false)}
              >
                Remove All
              </Button>
            </>
          )}

          <Button disabled={disabled} onClick={handleSubmit}>
            {initialLoading
              ? 'Loading...'
              : loading
                ? 'Saving...'
                : 'Save'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* TAB SWITCH */}
      <div className="px-4 flex gap-2 my-2">
        <Button
          variant={tab === 1 ? 'secondary' : 'ghost'}
          onClick={() => setTab(1)}
        >
          Details
        </Button>

        <Button
          variant={tab === 2 ? 'secondary' : 'ghost'}
          onClick={() => setTab(2)}
        >
          Roles & Permissions
        </Button>
      </div>

      <Separator />

      {/* DETAILS TAB */}
      {tab === 1 && (
        <form className="space-y-4">
          <SuperUser />

          <div className="bg-white p-4 rounded-md">
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={`grid gap-2 ${field.component === 'textarea'
                    ? 'col-span-2'
                    : ''
                    }`}
                >
                  {field.key !== 'assigned_farms' && (
                    <Label required={field.required}>
                      {field.label}
                    </Label>
                  )}

                  {field.component === 'textarea' ? (
                    <Textarea
                      className="border-2 border-black/30"
                      value={(form as any)[field.key] || ''}
                      onChange={(e) =>
                        handleChange(
                          field.key as any,
                          e.target.value
                        )
                      }
                    />
                  ) : field.type === 'list' ? (
                    <SearchableDropdown
                      list={field.list || []}
                      codeLabel={field.code || ''}
                      nameLabel={field.name || ''}
                      value={(form as any)[field.key] || ''}
                      onChange={(v) =>
                        handleChange(field.key as any, v)
                      }
                    />
                  ) : field.type === 'multi-select' ? (
                    <SearchableCombobox
                      required
                      label={field.label}
                      multiple
                      showCode
                      items={field.list || []}
                      value={defaultFarms}
                      onValueChange={setDefaultFarms}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      type={field.type || 'text'}
                      value={(form as any)[field.key] || ''}
                      onChange={(e) =>
                        handleChange(
                          field.key as any,
                          e.target.value
                        )
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* PERMISSIONS TAB */}
      {tab === 2 && !initialLoading && (
        <div className="px-4">
          <RuleAndPerm
            userId={authSelected?.auth_id || '0'}
          />
        </div>
      )}

      {/* <DefaultFarmComboBox
        label='Default farm'
        setValue={setFarm}
        value={farm}
      /> */}
    </div>
  )
}
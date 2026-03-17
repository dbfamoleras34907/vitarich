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

import { updateUserProfile, getProfileByAuthId, getProfileNotByAuthIdIsSuper } from '../api'
import { User } from '@supabase/supabase-js'
import { SuperUsers, UserInsert, UserRow } from '@/lib/types'

import SuperUser from './SuperUser'
import RuleAndPerm from './RuleAndPerm'
import SearchableDropdown from '@/lib/SearchableDropdown'

import { DefaultGenders } from '@/lib/Defaults/DefaultValues'
import { ColumnsYesOrNoCodeOnly } from '@/lib/Defaults/DefaultColumns'
import { InputDropDown } from '@/components/ui/InputDropDown'
import { getvwdmf_get_farmlist_code_name_farmtype } from './api'
import { sleep } from '@/lib/utils'

type authProps = {
  email: string
  id: string
  auth_id: string
}

export default function Layout() {
  const { getValue, setValue } = useGlobalContext()

  const [tab, setTab] = useState(1)
  const [form, setForm] = useState<Partial<UserRow>>({})
  const [authSelected, setAuthSelected] = useState<authProps>()
  const [defaultfarmlist, setDefaultFarmList] = useState<any[]>([])
  const [superuserlsit, setsuperuserlsit] = useState<SuperUsers[]>([])
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null)

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const fields = [
    { key: 'firstname', label: 'First Name', required: true },
    { key: 'middlename', label: 'Middle Name' },
    { key: 'lastname', label: 'Last Name', required: true },
    { key: 'mobile', label: 'Mobile' },
    { key: 'birthdate', label: 'Birthdate', type: 'date' },
    { key: 'gender', label: 'Gender', type: "list", list: DefaultGenders, code: "code", name: "name", showOnlyName: true },
    { key: 'phone', label: 'Phone' },
    { key: 'location', label: 'Address' },
    { key: 'default_farm', label: 'Default Farm', type: 'list', list: defaultfarmlist, code: 'code', name: "name" },
    { key: 'supervisor', label: 'Supervisor', type: 'list', list: superuserlsit, code: 'code', name: "name" },
    // { key: 'supervisor', label: 'Supervisor', type: 'list', list: superuserlsit, code: 'code', name: "name" },
    { key: 'remarks', label: 'Remarks', component: 'textarea' },
  ]

  const handleChange = useCallback((key: keyof UserInsert, value: any) => {
    setForm((p) => ({ ...p, [key]: value }))
  }, [])

  const handleSubmit = async () => {
    if (!loggedInUser?.id) return toast.error('Administrator not authenticated')
    if (!authSelected?.id) return toast.error('No user selected')
    if (tab !== 1) return toast.warning("Go to 'Details' tab to save")

    setLoading(true)

    try {
      await updateUserProfile({
        ...form,
        auth_id: authSelected.auth_id,
        created_by: loggedInUser.id,
      } as UserInsert)

      toast.success(`Profile for ${authSelected.email} saved`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  // const fetchProfile = async () => {

  //   setInitialLoading(true)

  //   try {
  //     const profile = await getProfileByAuthId(authSelected?.auth_id ?? "")
  //     console.log({ profile })
  //     setForm(profile || {})
  //   } catch {
  //     toast.error('Failed to load profile')
  //   } finally {
  //     setInitialLoading(false)
  //   }
  // }
  useEffect(() => {
    setValue("loading_g", loading || initialLoading)
  }, [loading, initialLoading])
  const fetchProfile = async () => {
    setInitialLoading(true)

    try {
      const profile = await getProfileByAuthId(authSelected?.auth_id ?? "")
      console.log({ profile })

      setForm({
        ...profile,
        supervisor: profile?.supervisor ? String(profile.supervisor) : ""
      })
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setInitialLoading(false)
    }
  }
  const togglePermissions = (enable: boolean) => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      '#permissions-container .permission-checkbox'
    )

    let changed = 0

    checkboxes.forEach((c) => {
      if (c.checked !== enable) {
        c.click()
        changed++
      }
    })

    toast.success(
      changed
        ? `${enable ? 'Enabled' : 'Disabled'} ${changed} permissions`
        : `All permissions already ${enable ? 'enabled' : 'disabled'}`
    )
  }

  const getSuperUser = async () => {
    const data = await getProfileNotByAuthIdIsSuper(authSelected?.auth_id || "")
    console.log({ data })
    setsuperuserlsit(data)
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await db.auth.getSession()
      setLoggedInUser(data.session?.user ?? null)

      const farms = await getvwdmf_get_farmlist_code_name_farmtype()
      setDefaultFarmList(farms)
    }

    init()

  }, [])

  useEffect(() => {
    setAuthSelected(getValue('selectedUser'))
  }, [getValue])

  useEffect(() => {
    if (!authSelected?.auth_id) return
    console.log(authSelected?.auth_id)
    getSuperUser()
    fetchProfile()
  }, [authSelected])

  const disabled = loading || initialLoading || tab !== 1 || !authSelected?.id

  return (
    <div>
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
            {initialLoading ? 'Loading...' : loading ? 'Saving...' : 'Save'}
          </Button>
          {/* <Button onClick={getSuperUser}>check getSuperUser</Button> */}
          {/* <Button onClick={() => console.log({ form })}>check form</Button> */}
        </div>
      </div>

      <Separator />

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

      {tab === 1 && (
        <form className="space-y-4">
          <SuperUser />

          <div className="bg-white p-4 rounded-md">
            <div className="grid grid-cols-3 gap-4">
              {fields.map((f) => (
                <div
                  key={f.key}
                  className={`${f.component === 'textarea' ? 'col-span-3' : ''} grid gap-2`}
                >
                  <Label required={f.required}>{f.label}</Label>

                  {f.key === 'gexnder' ? (
                    <InputDropDown
                      data={DefaultGenders}
                      columns={ColumnsYesOrNoCodeOnly as any}
                      onClick={(e: any) => handleChange(f.key as any, e.code)}
                    />
                  ) : f.component === 'textarea' ? (
                    <Textarea
                      className="border-2 border-black/30"
                      value={(form as any)[f.key] || ''}
                      onChange={(e) =>
                        handleChange(f.key as any, e.target.value)
                      }
                    />
                  ) : f.type === 'list' ? (
                    <SearchableDropdown
                      list={f.list || []}
                      codeLabel={f.code || ""}
                      nameLabel={f.name || ""}
                      // showNameOnly
                      value={(form as any)[f.key] || ''}
                      onChange={(v) => handleChange(f.key as any, v)}
                    />
                  ) : (
                    <Input
                      type={f.type || 'text'}
                      value={(form as any)[f.key] || ''}
                      onChange={(e) =>
                        handleChange(f.key as any, e.target.value)
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>
      )}

      {tab === 2 && !initialLoading && (
        <div className="px-4">
          <RuleAndPerm userId={authSelected?.auth_id || '0'} />
        </div>
      )}
    </div>
  )
}
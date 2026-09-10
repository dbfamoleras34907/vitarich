"use client"

import { useState, useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import type { User } from "@supabase/supabase-js"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { LoaderIcon } from "lucide-react"
import SignUpStage from "../signup/SignUpStage"
import SearchableDropdown from "@/lib/SearchableDropdown"
import { db } from "@/lib/Supabase/supabaseClient"
import { getProfileByAuthId } from "../admin/user/api"
import { DefaultGenders, islandGrouplist, regionList } from "@/lib/Defaults/DefaultValues"
import { PERSONAL_INFORMATION_FIELDS, REGISTRATION_FMS_TYPES, validateRegistrationProfile, type RegistrationProfile, type RegistrationFarmOption } from "@/lib/auth/personalInformation"
import { savePersonalInformation, getRegistrationFarms } from "@/lib/data/repositories/registration"

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "Unable to load or save personal information. Please try again."
}

export default function Layout() {
  const router = useRouter()
  const [form, setForm] = useState<RegistrationProfile>({})
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [sessionUser, setSessionUser] = useState<User | null>(null)
  const [farms, setFarms] = useState<RegistrationFarmOption[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await db.auth.getSession()
        if (error) throw error
        if (!data.session) {
          router.replace("/login")
          return
        }
        const [profile, farmOptions] = await Promise.all([
          getProfileByAuthId(data.session.user.id),
          getRegistrationFarms(),
        ])
        if (cancelled) return
        const personal: RegistrationProfile = {
          fms_type: profile?.fms_type ?? "",
          farm_id: farmOptions.find((farm) => farm.code === profile?.default_farm)?.id ?? null,
        }
        for (const field of PERSONAL_INFORMATION_FIELDS) personal[field.key] = profile?.[field.key] ?? ""
        setForm(personal)
        setFarms(farmOptions)
        setSessionUser(data.session.user)
      } catch (error) {
        if (!cancelled) toast.error(errorMessage(error))
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || !sessionUser) return
    const validationError = validateRegistrationProfile(form)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setLoading(true)
    try {
      await savePersonalInformation(form)
      toast.success(`Profile for ${sessionUser.email} saved. Please contact your administrator for account activation.`)
      router.push("/logout")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto my-4 w-full max-w-2xl px-3">
      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          src="https://cdn.prod.website-files.com/6819a7964b427b4964f82cc0/68203089539798c6cc2ba1c0_Corporate-Logo_Vitarich-White.png"
          alt="Vitarich Logo" width={110} height={110}
        />
        <h1 className="text-2xl">Create your account</h1>
        <p className="text-muted-foreground text-sm">Enter your personal information</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-md border bg-card p-4 text-card-foreground">
        <SignUpStage currentStage={2} />
        <div className="grid gap-1.5">
          <Label htmlFor="registration-email">Email</Label>
          <Input id="registration-email" type="email" value={sessionUser?.email ?? ""} readOnly />
        </div>
        <div className="grid gap-1.5">
          <Label required>FMS Type</Label>
          <SearchableDropdown
            list={REGISTRATION_FMS_TYPES}
            codeLabel="code" nameLabel="name" showNameOnly
            value={form.fms_type ?? ""}
            disabled={initialLoading || loading}
            onChange={(value) => setForm((previous) => ({ ...previous, fms_type: value }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label required>Farm</Label>
          <SearchableDropdown
            list={farms.map((farm) => ({ code: String(farm.id), name: `${farm.code} - ${farm.name}` }))}
            codeLabel="code" nameLabel="name" showNameOnly
            value={form.farm_id ? String(form.farm_id) : ""}
            disabled={initialLoading || loading}
            onChange={(value) => setForm((previous) => ({ ...previous, farm_id: value ? Number(value) : null }))}
          />
          <p className="text-xs text-muted-foreground">This will be your default and assigned farm.</p>
          {!initialLoading && farms.length === 0 && <p className="text-xs text-destructive">No active, approved farms are available.</p>}
        </div>
        {(["Identity", "Contact"] as const).map((section) => (
          <section key={section} className="rounded-md border">
            <h2 className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">{section}</h2>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {PERSONAL_INFORMATION_FIELDS.filter((field) => field.section === section).map((field) => (
                <div key={field.key} className="grid gap-1.5">
                  <Label htmlFor={`registration-${field.key}`} required={field.required} className="text-xs">{field.label}</Label>
                  {field.type === "list" ? (
                    <SearchableDropdown
                      list={field.key === "gender" ? DefaultGenders : field.key === "region" ? regionList : islandGrouplist}
                      codeLabel="code" nameLabel="name"
                      value={form[field.key] ?? ""}
                      disabled={initialLoading || loading}
                      onChange={(value) => setForm((previous) => ({ ...previous, [field.key]: value }))}
                    />
                  ) : (
                    <Input
                      id={`registration-${field.key}`} type={field.type} required={field.required}
                      value={form[field.key] ?? ""} disabled={initialLoading || loading}
                      onChange={(event) => setForm((previous) => ({ ...previous, [field.key]: event.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        <Button type="submit" disabled={initialLoading || loading || !sessionUser}>
          {initialLoading || loading ? <LoaderIcon className="animate-spin" /> : "Finish Registration"}
        </Button>
      </form>
    </div>
  )
}

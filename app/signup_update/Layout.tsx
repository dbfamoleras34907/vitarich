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
import SearchableDropdown from "@/lib/SearchableDropdown"
import { db } from "@/lib/Supabase/supabaseClient"
import { DefaultGenders, islandGrouplist, regionList } from "@/lib/Defaults/DefaultValues"
import { PERSONAL_INFORMATION_FIELDS, validatePersonalInformation, type PersonalInformation } from "@/lib/auth/personalInformation"
import { savePersonalInformation, getRegistrationStatus } from "@/lib/data/repositories/registration"

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "Unable to load or save personal information. Please try again."
}

export default function Layout() {
  const router = useRouter()
  const [form, setForm] = useState<PersonalInformation>({})
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [sessionUser, setSessionUser] = useState<User | null>(null)

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
        const status = await getRegistrationStatus()
        if (cancelled) return
        if (status.approvalStatus !== "activated") {
          await db.auth.signOut()
          router.replace("/login")
          return
        }
        if (status.registrationReady === false || status.profileComplete) {
          router.replace("/init")
          return
        }
        setForm(status.profile)
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
    const validationError = validatePersonalInformation(form)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setLoading(true)
    try {
      await savePersonalInformation(form)
      toast.success("Your information has been saved.")
      router.replace("/init")
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
        <h1 className="text-2xl">Complete Your Information</h1>
        <p className="text-muted-foreground text-sm">Complete the required information to continue to Vita FMS.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-md border bg-card p-4 text-card-foreground">
        <div className="grid gap-1.5">
          <Label htmlFor="registration-email">Email</Label>
          <Input id="registration-email" type="email" value={sessionUser?.email ?? ""} readOnly />
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
          {initialLoading || loading ? <LoaderIcon className="animate-spin" /> : "Save and Continue"}
        </Button>
        <Button type="button" variant="secondary" disabled={loading} onClick={() => router.replace("/logout")}>Logout</Button>
      </form>
    </div>
  )
}

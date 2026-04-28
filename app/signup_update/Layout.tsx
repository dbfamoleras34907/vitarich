"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { LoaderIcon } from "lucide-react"
import SignUpStage from "../signup/SignUpStage"
import SearchableDropdown from "@/lib/SearchableDropdown"
import { db } from "@/lib/Supabase/supabaseClient"
import { getUserInfoAuthSession,  signupUser, updateUserProfile } from "../admin/user/api"
import Image from "next/image"
import { useGlobalContext } from "@/lib/context/GlobalContext"

const details = [
  { required: true, key: "firstname", label: "First Name", type: "text" },
  { required: true, key: "middlename", label: "Middle Name", type: "text" },
  { required: true, key: "lastname", label: "Last Name", type: "text" },
  { required: true, key: "birthdate", label: "Birthday", type: "date" },
  {
    required: true,
    key: "gender",
    label: "Gender",
    type: "search",
    list: [
      { code: "Male", name: "Male" },
      { code: "Female", name: "Female" }
    ]
  },
  { required: true, key: "location", label: "Address", type: "text" },
]

export default function Layout() {

  const router = useRouter()
  const { getValue } = useGlobalContext();
  const [email, setemail] = useState("")
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [sessionUser, setSessionUser] = useState<any>(null)

  const handleChange = (key: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      [key]: value
    }))
  }

  /**
   * Load session
   */
  useEffect(() => {

    const loadSession = async () => {

      const {
        data: { session },
      } = await db.auth.getSession()

      if (!session) {
        router.push("/logout")
        return
      }

      setSessionUser(session.user)

    }

    loadSession()

  }, [router])

  /**
   * Prevent leaving page during registration
   */
  useEffect(() => {

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }

  }, [])

  const handleSubmit = async () => {

    if (!sessionUser?.id) {
      toast.error("User session not found")
      return
    }

    setLoading(true)

    try {

      await signupUser({
        ...form,
        auth_id: sessionUser.id,
        created_by: sessionUser.id,
        email: sessionUser.email,

        // profile_completed: true

      })

      toast.success(`Profile for ${sessionUser.email} saved`)

      router.push("/logout")

    } catch (e: any) {

      toast.error(e.message)

    } finally {

      setLoading(false)

    }

  }




  const getEmail = async () => {
    try {
      // const data = await getUserInfoAuthSession();
      // // setValue("UserInfoAuthSession", data);
      // console.log("UserInfoAuthSession", data);


      const { data: { session },
      } = await db.auth.getSession();
      setemail(session?.user.email || "")


      // setForm((prev: any) => ({
      //   ...prev,
      //   email: email
      // }))
    } catch (error) {
    }
  }
  useEffect(() => {
    getEmail()
  }, [])


  return (
    <div className="w-90 mx-auto mt-4">

      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          src="https://cdn.prod.website-files.com/6819a7964b427b4964f82cc0/68203089539798c6cc2ba1c0_Corporate-Logo_Vitarich-White.png"
          alt="Vitarich Logo"
          width={110}
          height={110}
        />

        <h1 className="text-2xl">Create your account</h1>

        <p className="text-muted-foreground text-sm">
          Enter your personal information
        </p>
      </div>
      <div className="max-w-md mx-auto mt-10 grid gap-4 bg-white p-6 border rounded-md">

        <SignUpStage currentStage={2} />


        <Label >
          Email
        </Label>
        <Input
          required={true}
          type={"email"}
          defaultValue={email}
        />
        {details.map((f, i) => (

          <div key={i} className="grid gap-2">

            <Label required={f.required}>
              {f.label}
            </Label>

            {f.type === "search" ? (

              <SearchableDropdown
                list={f.list || []}
                codeLabel="code"
                nameLabel="name"
                showNameOnly
                value={form[f.key] || ""}
                onChange={(v) => handleChange(f.key, v)}
              />

            ) : (

              <Input
                required={f.required}
                type={f.type}
                value={form[f.key] || ""}
                onChange={(e) =>
                  handleChange(f.key, e.target.value)
                }
              />

            )}

          </div>

        ))}

        <Button
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <LoaderIcon className="animate-spin" />
            : "Finish Registration"}
        </Button>


      </div>
    </div>


  )
}
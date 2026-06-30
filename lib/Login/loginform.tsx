"use client";
import { useState } from "react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderIcon, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { db } from "../Supabase/supabaseClient";
import { useGlobalContext } from "../context/GlobalContext";
import { useGlobalDefaults } from "../Defaults/GlobalDefaults";
import { Modal } from "../Moda";
import { encryptValue } from "../encrypt";
import { createApprovalRequest } from "./api";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [reason, setReason] = useState("");
  const { setGlobals } = useGlobalDefaults()
  const [openModal, setOpenModal] = useState(false);
  const [loading, setloading] = useState(false);
  const router = useRouter();
  const { setValue } = useGlobalContext()
  const [showpass, setshowpass] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setloading(true)
    try {
      const { error } = await db.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast(error.message)
        setloading(false)
      } else {
        setGlobals()
        setValue('loading_g', true)
        router.push("/init");
        setloading(false)
        setValue('loading_g', false)
      }
    } catch (error) {
      alert("An error occurred during login. Please try again.")
    }
  }

  async function handleSubmit() {
    try {
      const encryptedPassword = encryptValue(resetPassword)
      const { data: { session }, } = await db.auth.getSession();
      const payload = {
        created_by: resetEmail,
        user_email: resetEmail,
        request_type: "password_reset",
        value_encrypted: encryptedPassword,
        remarks: reason
      }
      // console.log({ payload, session })

      // return
      await createApprovalRequest(payload)
      toast("Password reset request submitted")
      setOpenModal(false)
      setResetPassword("")
      setReason("")
    } catch (error) {
      toast("Incorrect email")
      console.log({ error })
    }
  }

  return (
    <form className={cn("flex flex-col gap-4", className)} {...props} onSubmit={handleLogin}>
      <div className="grid gap-5 rounded-md border border-[#ded7cd] bg-white p-5 shadow-[0_18px_45px_rgba(20,55,38,0.12)] sm:p-6">
        <div className="grid gap-3">
          <Label className="text-[#243c2f]">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6d7b72]" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-[#fffdf8] pl-9"
              placeholder="name@vitarich.com"
              required
            />
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center">
            <Label className="text-[#243c2f]">Password</Label>
            <span
              onClick={() => setOpenModal(true)}
              className="ml-auto cursor-pointer text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Forgot Password?
            </span>
          </div>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6d7b72]" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-[#fffdf8] pl-9"
              placeholder="Enter your password"
              required
            />
          </div>
        </div>

        <Button type="submit" size="lg" className="mt-1 w-full bg-[#00754a] hover:bg-[#006241]" disabled={loading}>
          {loading ? <LoaderIcon className="animate-spin" /> : <>Login <ArrowRight className="size-4" /></>}
        </Button>
      </div>
      <div className="rounded-md border border-[#ded7cd] bg-white/75 p-4 text-center text-sm text-[#617167] shadow-[var(--starbucks-card-shadow)]">
        <div className="mx-auto flex flex-wrap justify-center gap-2">
          <span>New to FMS?</span><a href="/signup" className="font-semibold text-primary">Create an account</a>
        </div>
      </div>
      <Modal
        open={openModal}
        onOpenChange={setOpenModal}
        title="Forgot Password Reset Request"
        description="Send a password reset request to your supervisor"
        className="max-w-md"
      >
        <div className="p-4 gap-4 grid">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>New Password</Label>
              <button
                onClick={() => setshowpass(!showpass)}
                className="cursor-pointer text-sm font-semibold text-primary underline" >
                {showpass ? "Hide" : "Show"}
              </button>
            </div>
            <Input
              type={showpass ? "text" : "password"}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />

          </div>

          <div className="space-y-2">
            <Label>Reason for password reset</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setOpenModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Submit
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  )
}

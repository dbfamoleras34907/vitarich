"use client";
import { useState } from "react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation";
import { LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { db } from "../Supabase/supabaseClient";
import { useGlobalContext } from "../context/GlobalContext";
import { useGlobalDefaults } from "../Defaults/GlobalDefaults";
import Image from "next/image";
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
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleLogin}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          src="https://cdn.prod.website-files.com/6819a7964b427b4964f82cc0/68203089539798c6cc2ba1c0_Corporate-Logo_Vitarich-White.png"
          alt="Vitarich Logo"
          width={110}
          height={110}
        />
        <h1 className="text-2xl">Login to your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your email below to login to your account
        </p>
      </div>
      <div>
      </div>
      <div className="grid gap-6 bg-white p-4 rounded-md border border-black/20 shadow">
        <div className="grid gap-3">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-3">
          <div className="flex items-center">
            <Label>Password</Label>
            <span
              onClick={() => setOpenModal(true)}
              className="cursor-pointer text-blue-700 font-semibold ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot Password?
            </span>
          </div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <LoaderIcon className="animate-spin" /> : "Login"}
        </Button>
      </div>
      <div className=" gap-6  p-4 rounded-md border border-black/20 shadow flex text-sm text-center ">
        <div className="mx-auto flex gap-2">
          New to Hatchery?<a href="/signup" className="text-blue-600 font-semibold">Create an account</a>
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
            <Label>New Password</Label>
            <Input
              type="password"
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
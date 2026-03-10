"use client";
import { useState } from "react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation";
import { LoaderIcon } from "lucide-react";
import { toast } from "sonner";
// import { useGlobalDefaults } from "./GlobalDefaults";
import { db } from "../Supabase/supabaseClient";
import { useGlobalContext } from "../context/GlobalContext";
import { useGlobalDefaults } from "../Defaults/GlobalDefaults";
import Image from "next/image";
import { Modal } from "../Moda";
// import { getAllBranch } from "@/app/a_dean/api/branch-api";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("");
  const { setGlobals } = useGlobalDefaults()
  const [openModal, setOpenModal] = useState(false);
  const [showpassword, setshowpassword] = useState(false)
  const [password, setPassword] = useState("");
  const [loading, setloading] = useState(false);
  const router = useRouter();
  const { setValue } = useGlobalContext()
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setloading(true)
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });


    if (error) {
      toast(error.message)
      setloading(false)

    } else {
      setGlobals()
      setValue('loading_g', true)
      router.push("/home");
      setloading(false)
      setValue('loading_g', false)


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
          className=""
        />
        <h1 className="text-2xl ">Login to your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your email below to login to your account
        </p>
      </div>
      <div className="grid gap-6 bg-white p-4 rounded-md border">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            type="email"
            // placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a
              // href="#"
              onClick={() => setOpenModal(true)}
              className="cursor-pointer text-blue-700 font-semibold ml-auto text-sm underline-offset-4 hover:underline"
            >Forgot Password?
            </a>
          </div>
          <Input id="password" type="password" required
            // placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 rounded"

          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <LoaderIcon className="animate-spin" /> : "Login"}
        </Button>

        {/* <Button onClick={() => console.log({ user })}> Get user info</Button> */}
        {/* <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
        </div> */}
      </div>
      {/* <div className="text-center text-sm">
        <Button type="submit" className="w-full" disabled>
          {loading ? <LoaderIcon className="animate-spin" /> : "Change Company"}
        </Button>
      </div> */}

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
            <Input type="email" />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" />
          </div>

          <div className="space-y-2">
            <Label>Reason for password reset</Label>
            <Input />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button className="" variant={"secondary"}> Cancel </Button>
            <Button className="" > Submit </Button>
          </div>
        </div>
      </Modal>
    </form>
  )
}

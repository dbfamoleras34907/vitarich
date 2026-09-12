"use client";
import { useState } from "react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { registerAccount } from "@/lib/data/repositories/registration";

export function Layout({
    className,
    ...props
}: React.ComponentProps<"form">) {

    const [submitted, setSubmitted] = useState(false)

    const [form, setForm] = useState({
        email: "",
        password: "",
        re_password: ""
    })

    const [loading, setloading] = useState(false)

    const account = [
        { required: true, key: "email", label: "Email", type: "email" },
        { required: true, key: "password", label: "Password", type: "password" },
        { required: true, key: "re_password", label: "Confirm Password", type: "password" },
    ] as const

    const handleChange = (key: string, value: string) => {
        setForm(prev => ({
            ...prev,
            [key]: value
        }))
    }

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    const validatePassword = (password: string) => {

        if (password.length < 8) {
            return "Password must be at least 8 characters"
        }

        if (!/[A-Z]/.test(password)) {
            return "Password must include an uppercase letter"
        }

        if (!/[a-z]/.test(password)) {
            return "Password must include a lowercase letter"
        }

        if (!/[0-9]/.test(password)) {
            return "Password must include a number"
        }

        // if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
        //     return "Password must include a special character"
        // }

        return null
    }

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault()
        if (loading) return
        setloading(true)

        const { email, password, re_password } = form

        if (!email || !password || !re_password) {
            toast.warning("Please complete all fields.")
            setloading(false)
            return
        }

        if (!validateEmail(email)) {
            toast.error("Please enter a valid email.")
            setloading(false)
            return
        }

        const passwordError = validatePassword(password)

        if (passwordError) {
            toast.error(passwordError)
            setloading(false)
            return
        }

        if (password !== re_password) {
            toast.error("Passwords do not match.")
            setloading(false)
            return
        }

        try {

            await registerAccount({ email, password })
            setForm({ email: "", password: "", re_password: "" })
            setSubmitted(true)

        } catch (err) {
            toast.error(
                err && typeof err === "object" && "message" in err && typeof err.message === "string"
                    ? err.message
                    : "Unable to register your account. Please try again."
            )
        } finally {
            setloading(false)
        }
    }

    if (submitted) return (
        <div className="grid gap-3 rounded-md border bg-card p-6 text-center">
            <h1 className="text-xl font-semibold">Awaiting activation</h1>
            <p className="text-sm text-muted-foreground">Your account has been registered. Please wait for administrator approval. We will email you when your registration is activated or rejected.</p>
            <a href="/login" className="text-sm font-semibold text-primary">Back to Login</a>
        </div>
    )

    return (
        <form
            className={cn("flex flex-col gap-6", className)}
            {...props}
            onSubmit={handleCreateUser}
        >

            <div className="flex flex-col items-center gap-2 text-center">
                <Image
                    src="https://cdn.prod.website-files.com/6819a7964b427b4964f82cc0/68203089539798c6cc2ba1c0_Corporate-Logo_Vitarich-White.png"
                    alt="Vitarich Logo"
                    width={110}
                    height={110}
                />

                <h1 className="text-2xl">Create your account</h1>

                <p className="text-muted-foreground text-sm">
                    Enter your email and password
                </p>
            </div>

            <div className="grid gap-4 bg-white p-4 rounded-md border">


                {account.map((e, i) => (
                    <div key={i} className="grid gap-2">

                        <Label required={e.required}>
                            {e.label}
                        </Label>

                        <Input
                            required={e.required}
                            type={e.type}
                            value={form[e.key] || ''}
                            onChange={(v) =>
                                handleChange(e.key, v.target.value)
                            }
                        />

                        {e.key === "password" && (
                            <p className="text-xs text-muted-foreground">
                                Password must be at least 8 characters and include
                                uppercase, lowercase, and a number.
                            </p>
                        )}

                    </div>
                ))}

                <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                >
                    {loading
                        ? <LoaderIcon className="animate-spin" />
                        : "Sign Up"}
                </Button>

            </div>

        </form>
    )
}

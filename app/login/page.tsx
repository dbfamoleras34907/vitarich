export const dynamic = 'force-dynamic'

import Image from "next/image"
import { LoginForm } from "@/lib/Login/loginform"

export default function LoginPage() {
    return (
        <main className="min-h-screen bg-[#f6f4ee] text-[#1d2d25]">
            <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
                <section className="relative hidden overflow-hidden bg-[#0f5132] px-10 py-9 text-white lg:flex lg:flex-col">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(255,255,255,0.20),transparent_28%),linear-gradient(135deg,rgba(15,81,50,0.96),rgba(0,117,74,0.76)_52%,rgba(203,162,88,0.70))]" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(5,38,24,0.90)),repeating-linear-gradient(112deg,rgba(255,255,255,0.10)_0_1px,transparent_1px_46px)]" />
                    <div className="absolute -bottom-24 left-0 right-0 h-72 rounded-t-[50%] bg-[#f6f4ee]/12" />
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-[linear-gradient(135deg,rgba(212,233,226,0.22)_25%,transparent_25%),linear-gradient(225deg,rgba(212,233,226,0.18)_25%,transparent_25%)] bg-[length:80px_80px]" />

                    <div className="relative z-10 flex items-center justify-between">
                        <Image
                            src="https://cdn.prod.website-files.com/6819a7964b427b4964f82cc0/68203089539798c6cc2ba1c0_Corporate-Logo_Vitarich-White.png"
                            alt="Vitarich Logo"
                            width={148}
                            height={48}
                            priority
                            className="h-auto w-36"
                        />
                        <span className="rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
                            FMS Portal
                        </span>
                    </div>

                    <div className="relative z-10 mt-auto max-w-2xl pb-16">
                        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-[#dceee7]">
                            Welcome to Vitarich
                        </p>
                        <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] text-white">
                            Forging livelihood, nourishing lives.
                        </h1>
                        <p className="mt-6 max-w-lg text-base leading-7 text-white/82">
                            Sign in to continue managing farm operations, inventory, and daily workflows with the Vitarich team.
                        </p>
                    </div>
                </section>

                <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
                    <div className="w-full max-w-md">
                        <div className="mb-8 flex items-center justify-center lg:hidden">
                            <div className="rounded-md bg-[#0f5132] px-5 py-3 shadow-[var(--starbucks-card-shadow)]">
                                <Image
                                    src="https://cdn.prod.website-files.com/6819a7964b427b4964f82cc0/68203089539798c6cc2ba1c0_Corporate-Logo_Vitarich-White.png"
                                    alt="Vitarich Logo"
                                    width={132}
                                    height={42}
                                    priority
                                    className="h-auto w-32"
                                />
                            </div>
                        </div>

                        <div className="mb-7 text-center lg:text-left">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00754a]">
                                Welcome back
                            </p>
                            <h2 className="mt-3 text-3xl font-semibold text-[#123524]">
                                Sign in to your account
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-[#617167]">
                                Continue to the Vitarich Farm Management System.
                            </p>
                        </div>

                        <LoginForm />
                    </div>
                </section>
            </div>
        </main>
    )
}

export const dynamic = 'force-dynamic'

import Image from "next/image"
import { LoginForm } from "@/lib/Login/loginform"
import poultryHero from "./fms-poultry-hero.png"

export default function LoginPage() {
    return (
        <main className="min-h-screen bg-[#f6f4ee] text-[#1d2d25]">
            <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
                <section className="relative hidden overflow-hidden bg-[#075d38] px-12 py-12 text-white lg:flex lg:flex-col xl:px-16">
                    <Image
                        src={poultryHero}
                        alt=""
                        fill
                        priority
                        sizes="58vw"
                        className="object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,65,39,0.36),rgba(0,93,56,0.06)_48%,rgba(5,72,44,0.10)),linear-gradient(180deg,rgba(0,54,33,0.08),rgba(0,28,18,0.32))]" />

                    <div className="relative z-10 flex items-center justify-between">
                        <Image
                            src="https://cdn.prod.website-files.com/6819a7964b427b4964f82cc0/68203089539798c6cc2ba1c0_Corporate-Logo_Vitarich-White.png"
                            alt="Vitarich Logo"
                            width={190}
                            height={68}
                            priority
                            className="h-auto w-48"
                        />
                        <span className="rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-sm">
                            FMS Portal
                        </span>
                    </div>

                    <div className="relative z-10 mt-auto max-w-3xl pb-56">
                        <p className="mb-8 text-2xl font-semibold uppercase tracking-[0.24em] text-[#f1d99b]">
                            Welcome to
                        </p>
                        <h1 className="max-w-3xl text-6xl font-semibold leading-[1.02] text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.22)] xl:text-7xl">
                            Farm Management System
                        </h1>
                        <p className="mt-7 text-2xl font-semibold uppercase tracking-[0.22em] text-[#f1d99b]">
                            of Vitarich Corporation
                        </p>
                        <p className="mt-10 max-w-3xl text-xl leading-9 text-white">
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

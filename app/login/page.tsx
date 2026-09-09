export const dynamic = 'force-dynamic'

import Image from "next/image"
import { LoginForm } from "@/lib/Login/loginform"
import poultryHero from "./fms-poultry-hero.png"

export default function LoginPage() {
    return (
        <main className="min-h-full bg-background text-foreground lg:h-full lg:min-h-0 lg:overflow-hidden">
            <div className="grid min-h-full lg:h-full lg:min-h-0 lg:grid-cols-[1.08fr_0.92fr]">
                <section className="relative hidden min-h-0 overflow-hidden bg-[#075d38] px-12 py-[clamp(1.5rem,4vh,3rem)] text-white lg:flex lg:h-full lg:flex-col xl:px-16">
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

                    <div className="relative z-10 mt-auto max-w-3xl pb-[clamp(5rem,20vh,14rem)]">
                        <p className="mb-[clamp(1rem,3vh,2rem)] text-[clamp(1.125rem,2.5vh,1.5rem)] font-semibold uppercase tracking-[0.24em] text-[#f1d99b]">
                            Welcome to
                        </p>
                        <h1 className="max-w-3xl text-[clamp(3rem,7.5vh,4.5rem)] font-semibold leading-[1.02] text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.22)]">
                            Farm Management System
                        </h1>
                        <p className="mt-[clamp(1rem,2.5vh,1.75rem)] text-[clamp(1.125rem,2.5vh,1.5rem)] font-semibold uppercase tracking-[0.22em] text-[#f1d99b]">
                            of Vitarich Corporation
                        </p>
                        <p className="mt-[clamp(1.5rem,4vh,2.5rem)] max-w-3xl text-[clamp(1rem,2.1vh,1.25rem)] leading-relaxed text-white">
                            Sign in to continue managing farm operations, inventory, and daily workflows with the Vitarich team.
                        </p>
                    </div>
                </section>

                <section className="flex min-h-full items-center justify-center px-5 py-8 sm:px-8 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:py-[clamp(1.5rem,4vh,2rem)]">
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
                            <h2 className="mt-3 text-3xl font-semibold text-foreground">
                                Sign in to your account
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
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

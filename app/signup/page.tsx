export const dynamic = 'force-dynamic'


import bg from "./lofi.jpg"
import bg2 from "./avian.png"
import Image from "next/image"
import { Layout } from "./Layout"

export default function LoginPage() {
    return (
        <div className="  min-h-svh  max-w-content mx-auto p-4 pt-20">
            <div className="flex flex-col gap-4 p-6 md:p-10">
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <Layout />
                    </div>
                </div>
            </div>
        </div>
    )
}



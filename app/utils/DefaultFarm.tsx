
'use client'

import { Button } from "@/components/ui/button"
import UserFarmSearchCombobox from "@/components/ui/UserFarmSearchCombobox"
import { useGlobalContext } from "@/lib/context/GlobalContext"
import { Modal } from "@/lib/Moda"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

export default function DefaultFarm() {
    const pathname = usePathname()
    const { getValue, setValue } = useGlobalContext()
    const isAuthPage = ["/", "/login", "/init", "/logout", "/signup", "/signup_update"].includes(pathname)
    const farmModalOpen = !isAuthPage && Boolean(getValue("openDefaultfarmModal"))
    const currentDefaultFarmId = getValue("DefaultFarmId")
    const session = getValue("UserInfoAuthSession")
    const sessionDefaultFarmId = session?.[0]?.default_farm
    const defaultFarmId = currentDefaultFarmId ?? sessionDefaultFarmId ?? ""

    useEffect(() => {
        if (!currentDefaultFarmId && sessionDefaultFarmId) {
            setValue("DefaultFarmId", sessionDefaultFarmId)
        }
    }, [currentDefaultFarmId, sessionDefaultFarmId, setValue])

    return (
        <div>

            <Modal
                open={farmModalOpen}
                onOpenChange={(open) => setValue("openDefaultfarmModal", open)}
                title="Select Default Farm"
            >
                <div className="space-y-4 p-4">
                    <p className="text-sm text-muted-foreground">
                        Choose the farm that will be used as your default working location.
                    </p>

                    {/* Farm selector component */}
                    <div>
                        <UserFarmSearchCombobox
                            display="buttons"
                            value={defaultFarmId}
                            onValueChange={(farmId) => {
                                setValue("DefaultFarmId", Number(farmId))
                            }}
                        />
                    </div>
                </div>
                <Button
                    onClick={() => setValue("openDefaultfarmModal", false)}
                    className="bg-black text-white float-right mx-4 mb-3 hover:bg-black/70" size={"xs"}>Close</Button>
            </Modal>



        </div>
    )
}

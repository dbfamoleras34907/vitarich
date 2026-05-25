
'use client'

import { Button } from "@/components/ui/button"
import GlobalFarmUserSettings from "@/components/ui/GlobalFarmUserSettings"
import { useGlobalContext } from "@/lib/context/GlobalContext"
import { Modal } from "@/lib/Moda"
import { useEffect, useState } from "react"

export default function DefaultFarm() {
    const { getValue, setValue } = useGlobalContext()

    const [farmModalOpen, setFarmModalOpen] = useState(false)


    useEffect(() => {
        getValue("openDefaultfarmModal") && setFarmModalOpen(true)
    }, [getValue])


    useEffect(() => {
        !farmModalOpen && setValue("openDefaultfarmModal", false)
    }, [farmModalOpen])

    return (
        <div>

            <Modal
                open={farmModalOpen}
                onOpenChange={setFarmModalOpen}
                title="Select Default Farm"
            >
                <div className="space-y-4 p-4">
                    <p className="text-sm text-muted-foreground">
                        Choose the farm that will be used as your default working location.
                    </p>

                    {/* Farm selector component */}
                    <div className="max-h-100 overflow-y-auto">
                        <GlobalFarmUserSettings />
                    </div>
                </div>
                <Button
                    onClick={() => setFarmModalOpen(false)}
                    className="bg-black text-white float-right mx-4 mb-3 hover:bg-black/70" size={"xs"}>Close</Button>
            </Modal>



        </div>
    )
}

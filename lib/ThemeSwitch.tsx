'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Sun, CheckCircle2, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import React, { useState } from 'react'
import { Modal } from './Moda'

interface ThemeSwitchProps {
    collapsed?: boolean
    variant?: 'dialog' | 'toggle'
}

export default function ThemeSwitch({ collapsed = false, variant = 'dialog' }: ThemeSwitchProps) {
    const { resolvedTheme, setTheme, theme } = useTheme()
    const [openModal, setOpenModal] = useState(false);

    if (variant === 'toggle') {
        const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

        return (
            <Button
                variant="outline"
                type="button"
                onClick={() => setTheme(nextTheme)}
                aria-label="Toggle color theme"
                title="Toggle color theme"
                className="h-10 gap-2 bg-card/90 px-3 shadow-sm backdrop-blur-sm"
            >
                <Moon className="size-4 dark:hidden" />
                <Sun className="hidden size-4 dark:block" />
                <span className="text-xs font-semibold dark:hidden">Dark mode</span>
                <span className="hidden text-xs font-semibold dark:inline">Light mode</span>
            </Button>
        )
    }

    return (
        <div>
            <Tooltip delayDuration={0} disableHoverableContent={!collapsed}>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setOpenModal(!openModal)}
                        className={`w-full gap-2 px-3 py-2 justify-start ${collapsed ? "justify-center" : ""}`}
                    >
                        {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                        {!collapsed && <span>Toggle Theme</span>}
                    </Button>
                </TooltipTrigger>
                {collapsed && (
                    <TooltipContent side="right">
                        <p>Toggle Theme</p>
                    </TooltipContent>
                )}
            </Tooltip>

            <Modal
                open={openModal}
                onOpenChange={setOpenModal}
                title="Select Theme"
                description="Choose your preferred interface style."
                className="max-w-md w-full  "
            >
                <div className='grid gap-4 border-t grid-cols-2 p-4'>
                    <div 
                        onClick={() => setTheme('dark')}
                        className={`relative cursor-pointer flex justify-between items-start border-2 rounded-md h-36 p-3 transition-all
                            ${theme === 'dark' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-700 bg-gray-900'} 
                            bg-gray-900 text-white`}
                    >
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium">Dark</span>
                            {theme === 'dark' && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                        </div>
                        <div className='mt-1 w-10 h-2.5 rounded-2xl bg-gray-700'></div>
                    </div>

                    <div 
                        onClick={() => setTheme('light')}
                        className={`relative cursor-pointer flex justify-between items-start border-2 rounded-md h-36 p-3 transition-all
                            ${theme === 'light' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-200 bg-gray-100'} 
                            bg-gray-100 text-black`}
                    >
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium">Light</span>
                            {theme === 'light' && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                        </div>
                        <div className='mt-1 w-10 h-2.5 rounded-2xl bg-gray-400'></div>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

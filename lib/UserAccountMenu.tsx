"use client";
import React, { useState, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import ThemeSwitch from "./ThemeSwitch";
import { UserProfileCard } from "./DefaultFunctions";
import GlobalDefaults from "./Defaults/GlobalDefaults";
import { useOnClickOutside } from "./hooks/useOnClickOutside";
import { useRouter } from "next/navigation";
import GlobalFarmUserSettings from "@/components/ui/GlobalFarmUserSettings";

export default function UserAccountMenu({ session, collapsed }: any) {
  const route = useRouter()
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useOnClickOutside(menuRef, () => setIsOpen(false));

  return (
    <div className="relative w-full" ref={menuRef}>
      {/* 1. THE TRIGGER (Custom Button) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left outline-none transition-transform active:scale-[0.98]"
      >
        <UserProfileCard
          email={session?.user?.email ?? "guest@example.com"}
          description=""
        // If UserProfileCard has its own collapsed logic, pass it here
        />
      </button>

      {/* 2. THE MENU CONTENT */}
      {isOpen && (
        <div
          className={`
            bg-white mt-2  
            absolute top-full right-0 mb-2 w-full min-w-50
              border border-border rounded-lg shadow-xl 
            p-2 animate-in fade-in slide-in-from-bottom-2
          `}
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            My Account
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start font-normal h-9 px-2 gap-2"
          >
            Profile
          </Button>
          <Button
            onClick={() => route.push("/logout")}
            variant="ghost"
            className="w-full justify-start font-normal h-9 px-2 gap-2"
          >
            Logout
          </Button>
          {/* <GlobalFarmUserSettings /> */}

          <Separator className="my-2 " />

          {/* These components now live in a simple div, no "Dropdown Context" to break them */}
          <div className="flex flex-col gap-1">
            <GlobalDefaults collapsed={false} />
          </div>
        </div>
      )}
    </div>
  );
}
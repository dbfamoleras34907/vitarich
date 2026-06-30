"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import GlobalDefaults from "./Defaults/GlobalDefaults";
import { UserProfileCard } from "./DefaultFunctions";
import { Modal } from "./Moda";
import {
  ChevronRight,
  LogOut,
  RefreshCcw,
  UserCircle2,
} from "lucide-react";

export default function UserAccountMenu({
  session,
  collapsed = false,
}: any) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const email =
    session?.user?.email ?? "guest@example.com";

  const firstLetter =
    email.charAt(0).toUpperCase();

  return (
    <div className="w-full">
      {/* Trigger */}
      <button
        onClick={() =>
          setIsOpen((prev) => !prev)
        }
        className="w-full rounded-md text-left transition-colors"
      >
        <UserProfileCard
          email={email}
          description=""
          collapsed={collapsed}
        />
      </button>

      <Modal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Account"
        className="max-w-md"
      >
        <div className="overflow-hidden">
          {/* Profile Card */}
          <div className="px-4 pb-4">
            <button
              // onClick={() =>
              //   router.push("/profile")
              // }
              type="button"
              className="
                w-full
                rounded-md
                bg-secondary/70
                hover:bg-muted
                transition-all
                p-3
                flex items-center gap-3
              "
            >
              {/* Avatar */}
              <div
                className="
                  h-12 w-12 rounded-full
                  bg-orange-500
                  flex items-center justify-center
                  text-white
                  font-semibold
                  text-base
                  shrink-0
                "
              >
                {firstLetter}
              </div>

              {/* User Info */}
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-sm truncate">
                  {email}
                </p>

                <p className="text-xs text-muted-foreground">
                  &nbsp;
                </p>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>

          <Separator />

          {/* Menu Items */}
          <div className="p-2 space-y-1">
            {/* <MenuItem
              icon={
                <UserCircle2 className="h-4 w-4" />
              }
              label="Profile"
              onClick={() =>
                router.push("/profile")
              }
            /> */}
            <MenuItem
              icon={
                <RefreshCcw className="h-4 w-4" />
              }
              label="Refresh Data"
              onClick={() => {
                  window.location.reload();
              }}
            />
          </div>


          {/* Global Defaults */}
          <div className="pb-2 px-2 ">
            <GlobalDefaults collapsed={false} />
          </div>

          <Separator />

          {/* Logout */}
          <div className="p-2">
            <MenuItem
              icon={<LogOut className="h-4 w-4" />}
              label="Logout"
              destructive
              onClick={() => {
                setIsOpen(false)
                router.push("/logout")
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3
        rounded-md
        px-3 py-2
        text-sm font-medium
        transition-all
        hover:bg-muted
        ${destructive
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
          : ""
        }
      `}
    >
      <div
        className="
          h-8 w-8 rounded-full
          bg-muted
          flex items-center justify-center
          shrink-0
        "
      >
        {icon}
      </div>

      <span>{label}</span>
    </button>
  );
}

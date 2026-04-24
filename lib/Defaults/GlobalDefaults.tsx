/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import React, { useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { db } from "../Supabase/supabaseClient";

import { getUserPermissions } from "@/app/admin/user/new/api";
import { getItems } from "@/app/a_dean/items/api";
import {
  getFarmDB,
  getFarmDB_breeder,
} from "@/app/a_dean/receiving/manual/api";
import { getUserInfoAuthSession } from "@/app/admin/user/api";

import { Button } from "@/components/ui/button";
import { CloudDownload, RefreshCcw } from "lucide-react";

/* =======================================================
   HOOK
======================================================= */

export function useGlobalDefaults() {
  const { setValue } = useGlobalContext();
  const [loading, setLoading] = useState(false);

  /* -------------------------------------------------------
     helper: get session user once
  ------------------------------------------------------- */

  const getSessionUser = async () => {
    const {
      data: { session },
    } = await db.auth.getSession();

    return session?.user ?? null;
  };

  /* -------------------------------------------------------
     loaders
  ------------------------------------------------------- */

  const setActiveUsers = async () => {
    try {
      const data = await getActiveUsers();
      setValue("activeUsers", data);
      return data;
    } catch (error) {
      console.error("activeUsers error:", error);
    }
  };

  const setItems = async () => {
    try {
      const data = await getItems();
      setValue("itemmaster", data);
      return data;
    } catch (error) {
      console.error("itemmaster error:", error);
    }
  };

  const setFarms = async () => {
    try {
      const data = await getFarmDB();
      setValue("getFarmDB", data);
      return data;
    } catch (error) {
      console.error("getFarmDB error:", error);
    }
  };

  const setFarms_breeder = async () => {
    try {
      const data = await getFarmDB_breeder();
      setValue("getFarmDB_breeder", data);
      return data;
    } catch (error) {
      console.error("getFarmDB_breeder error:", error);
    }
  };

  const getUserInfoWithFarm = async () => {
    try {
      const data = await getUserInfoAuthSession();
      setValue("UserInfoAuthSession", data);
      return data;
    } catch (error) {
      console.error("UserInfoAuthSession error:", error);
    }
  };

  const setUserPermissions = async () => {
    try {
      const user = await getSessionUser();
      if (!user) return;

      const data = await getUserPermissions(user.id);
      setValue("UserPermission", data);

      return data;
    } catch (error) {
      console.error("UserPermission error:", error);
    }
  };

  /* -------------------------------------------------------
     batch loader
  ------------------------------------------------------- */

  const setGlobals = async () => {
    setLoading(true);
    setValue("loading_g", true);

    try {
      const user = await getSessionUser();
      if (!user) {
        console.warn("No active session found.");
        return;
      }

      await Promise.all([
        setUserPermissions(),
        setItems(),
        setActiveUsers(),
        setFarms(),
        setFarms_breeder(),
        getUserInfoWithFarm(),
      ]);
    } catch (error) {
      console.error("setGlobals error:", error);
    }

    setValue("loading_g", false);
    setLoading(false);
  };

  return {
    loading,
    setGlobals,
    setUserPermissions,
    setItems,
    setActiveUsers,
    setFarms,
    setFarms_breeder,
    getUserInfoWithFarm,
  };
}

/* =======================================================
   COMPONENT
======================================================= */

interface CollapsedProps {
  collapsed: boolean;
}

export default function GlobalDefaults({ collapsed }: CollapsedProps) {
  const { loading, setGlobals } = useGlobalDefaults();

  return (
    <div>
      <Button
        variant="ghost"
        type="button"
        onClick={setGlobals}
        disabled={loading}
        className={`w-full gap-2 px-3 py-2 justify-start ${collapsed ? "justify-center" : ""
          }`}
      >
        {loading ? (
          <RefreshCcw className="size-4 animate-spin" />
        ) : (
          <CloudDownload className="size-4" />
        )}

        {!collapsed && <span>Refresh Data</span>}
      </Button>
    </div>
  );
}

export async function getActiveUsers() {
  const { data: { session },
  } = await db.auth.getSession();
  const { data, error } = await db
    .from('vwdmf_get_activeusers')
    .select(`*`)
  // .eq('auth_id', session?.user.id);
  if (error) {
    console.error('Supabase Select Error:', error);
    throw new Error(error.message);
  }

  return data;
}
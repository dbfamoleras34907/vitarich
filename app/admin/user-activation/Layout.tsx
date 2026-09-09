"use client";

import Breadcrumb from "@/lib/Breadcrumb";
import DynamicTable, { type Column } from "@/components/ui/DataTableV2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/Supabase/supabaseClient";

type UserActivationRow = Record<string, unknown> & {
  id: number;
  created_at: string | null;
  email: string | null;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  auth_id: string | null;
  isactive: string | null;
  docStatus: string | null;
};

function fullName(row: UserActivationRow) {
  return [row.firstname, row.middlename, row.lastname]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export default function Layout() {
  const [rows, setRows] = useState<UserActivationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  const loadRows = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/userActivation", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load pending activations.");
      }

      setRows(result.users ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load pending activations.");
    } finally {
      setLoading(false);
    }
  };

  const activateUser = async (row: UserActivationRow) => {
    if (!confirm(`Activate ${row.email || "this user"}?`)) return;

    setActivatingId(row.id);
    try {
      const {
        data: { session },
      } = await db.auth.getSession();

      const response = await fetch("/api/admin/userActivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: row.id,
          approvedBy: session?.user?.id ?? null,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to activate user.");
      }

      toast.success("User activated.");
      setRows((current) => current.filter((item) => item.id !== row.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to activate user.");
    } finally {
      setActivatingId(null);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const columns = useMemo<Column<UserActivationRow>[]>(
    () => [
      { key: "id", label: "ID", align: "left" },
      { key: "email", label: "Email", align: "left" },
      {
        key: "name",
        label: "Name",
        align: "left",
        render: (row) => fullName(row) || "-",
      },
      {
        key: "created_at",
        label: "Registered",
        type: "date",
        align: "left",
      },
      {
        key: "status",
        label: "Status",
        align: "left",
        render: () => <Badge variant="secondary">Pending activation</Badge>,
      },
      {
        key: "action",
        label: "",
        type: "button",
        align: "right",
        render: (row) => (
          <Button
            size="sm"
            onClick={() => activateUser(row)}
            disabled={activatingId === row.id}
          >
            <Check className="h-4 w-4" />
            Activate
          </Button>
        ),
      },
    ],
    [activatingId]
  );

  return (
    <div className="mt-2 overflow-x-hidden">
      <div className="mx-4 mt-8 flex items-center justify-between gap-3">
        <Breadcrumb
          SecondPreviewPageName="Admin"
          CurrentPageName="User Activation"
        />
        <Button variant="secondary" onClick={loadRows} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="my-2" />

      <div className="mx-4">
        <DynamicTable
          loading={loading}
          columns={columns}
          data={rows}
          title="User Activation"
          description="Activate registered users without using the document approval module."
          searchPlaceholder="Search pending users..."
          emptyMessage="No pending user activations found."
          noResultsMessage="No matching pending users found."
        />
      </div>
    </div>
  );
}

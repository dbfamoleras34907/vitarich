"use client";

import Breadcrumb from "@/lib/Breadcrumb";
import DynamicTable, { type Column } from "@/components/ui/DataTableV2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getPendingActivations, submitRegistrationDecision, type UserActivationRow } from "@/lib/data/repositories/userActivation";
import { Modal } from "@/lib/Moda";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
function fullName(row: UserActivationRow) {
  return [row.firstname, row.middlename, row.lastname]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export default function Layout() {
  const router = useRouter();
  const [rows, setRows] = useState<UserActivationRow[]>([]);
  const [rejecting, setRejecting] = useState<UserActivationRow | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await getPendingActivations());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load pending activations.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const decideUser = async (row: UserActivationRow, decision: "activate" | "reject") => {
    if (activatingId !== null) return;
    if (decision === "activate" && !confirm(`Activate ${row.email || "this user"}?`)) return;
    setActivatingId(row.id);
    try {
      const user = await submitRegistrationDecision(row.id, decision, reason);
      toast.success(decision === "activate" ? "User activated. Email queued." : "Registration rejected. Email queued.");
      setRows(current => current.filter(item => item.id !== row.id));
      setRejecting(null);
      setReason("");
      if (decision === "activate" && user?.auth_id) router.push(`/admin/user-permissions?user=${encodeURIComponent(user.auth_id)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the decision.");
    } finally { setActivatingId(null); }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const columns: Column<UserActivationRow>[] = [
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
          <div className="flex justify-end gap-2"><Button
            size="sm"
            onClick={() => decideUser(row, "activate")}
            disabled={activatingId !== null}
          >
            <Check className="h-4 w-4" />
            Activate
          </Button>
          <Button size="sm" variant="destructive" disabled={activatingId !== null} onClick={() => { setRejecting(row); setReason(""); }}><X className="h-4 w-4" />Reject</Button></div>
        ),
      },
    ];

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

      <Modal open={Boolean(rejecting)} onOpenChange={open => { if (!open && activatingId === null) setRejecting(null); }} title="Reject Registration">
        <div className="grid gap-3 p-4">
          <p className="text-sm">The rejection reason will be emailed to {rejecting?.email}.</p>
          <label className="grid gap-1 text-sm">Reason<Input value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={activatingId !== null} /></label>
          <Button variant="destructive" disabled={!reason.trim() || activatingId !== null} onClick={() => rejecting && decideUser(rejecting, "reject")}>Reject and Send Email</Button>
        </div>
      </Modal>
      <Separator className="my-2" />

      <div className="mx-4">
        <p className="mb-3 text-sm text-muted-foreground">New public registrations have no assigned FMS Type and must be reviewed by a Super Admin. Admins can review registrations within their FMS Type.</p>
        {loadError ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={loadRows} disabled={loading}>Retry</Button>
          </div>
        ) : (
        <DynamicTable
          actionsFirst
          loading={loading}
          columns={columns}
          data={rows}
          title="User Activation"
          description="Review registrations. Activate or reject and email the applicant."
          searchPlaceholder="Search pending users..."
          emptyMessage="No pending user activations found."
          noResultsMessage="No matching pending users found."
        />
        )}
      </div>
    </div>
  );
}

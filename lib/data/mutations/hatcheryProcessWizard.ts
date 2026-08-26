import { db } from "@/lib/Supabase/supabaseClient";
import type { HatcheryWizardStage } from "@/lib/data/repositories/hatcheryProcessWizard";

const REVERSE_RPC: Record<HatcheryWizardStage, string> = {
  storage: "reverse_storage",
  pre_warming: "reverse_pre_warming",
  setter: "reverse_setter",
  transfer: "reverse_transfer",
  hatcher: "reverse_hatcher",
  pullout: "reverse_chick_pullout",
};

export async function voidHatcheryProcessWizardRecord(params: {
  stage: HatcheryWizardStage;
  recordId: number;
  reason: string;
}) {
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new Error("A valid void reason of at least 3 characters is required.");
  }

  const { data, error } = await db.rpc(REVERSE_RPC[params.stage], {
    p_doc_id: params.recordId,
  });

  if (error) throw error;
  if (data && typeof data === "object" && "success" in data && !data.success) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "The transaction could not be voided.",
    );
  }

  return data;
}

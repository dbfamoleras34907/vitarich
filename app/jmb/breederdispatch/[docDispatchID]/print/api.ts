import {
  getBreederDispatchById,
  type BreederDispatchDetail,
  type BreederDispatchLine,
} from "../../new/api";

export type BreederDispatchPrintItem = BreederDispatchLine & {
  production_code: string;
  description: string;
  uom: string;
};

export type BreederDispatchPrintPayload = {
  header: BreederDispatchDetail;
  items: BreederDispatchPrintItem[];
};

export async function getBreederDispatchPrint(
  docDispatchID: number,
): Promise<BreederDispatchPrintPayload> {
  if (!Number.isInteger(docDispatchID) || docDispatchID <= 0) {
    throw new Error("Invalid breeder dispatch document ID.");
  }

  const header = await getBreederDispatchById(docDispatchID);
  const items = header.lines.map((line) => ({
    ...line,
    production_code: line.category.replaceAll("_", " ").toUpperCase(),
    description: `${line.source_type} - ${line.category_label}`,
    uom: "PC",
  }));

  return { header, items };
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { Button } from "@/components/ui/button";
import Breadcrumb from "@/lib/Breadcrumb";
import {
  getBreederDispatchPrint,
  type BreederDispatchPrintItem,
  type BreederDispatchPrintPayload,
} from "./api";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH");
}

const blankItem = (lineNo: number): BreederDispatchPrintItem => ({
  line_no: lineNo,
  source_type: "Population Record",
  source_record_id: 0,
  source_date: "",
  category: "",
  category_label: "",
  placement_id: null,
  placement_date: null,
  building_id: null,
  building_name: "",
  pen_id: null,
  pen_name: null,
  dr_no: null,
  source_available: 0,
  dispatch_qty: 0,
  remarks: null,
  production_code: "",
  description: "",
  uom: "",
});

export default function Layout() {
  const router = useRouter();
  const { docDispatchID } = useParams<{ docDispatchID: string }>();
  const [payload, setPayload] = useState<BreederDispatchPrintPayload | null>(null);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: payload
      ? `Breeder Dispatch - ${payload.header.document_no}`
      : "Breeder Dispatch - Transfer Slip",
  });

  useEffect(() => { void refreshSessionx(router); }, [router]);
  useEffect(() => {
    let cancelled = false;
    getBreederDispatchPrint(Number(docDispatchID))
      .then((result) => { if (!cancelled) setPayload(result); })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load breeder dispatch for printing.");
      });
    return () => { cancelled = true; };
  }, [docDispatchID]);

  const lineItems = useMemo(() => {
    const rows = [...(payload?.items ?? [])];
    while (rows.length < 12) rows.push(blankItem(rows.length + 1));
    return rows;
  }, [payload]);
  const totalQty = payload?.items.reduce((sum, item) => sum + Number(item.dispatch_qty || 0), 0) ?? 0;
  const header = payload?.header;

  return (
    <main className="pb-8">
      <div className="print-hidden flex items-center justify-between px-4 py-5">
        <Breadcrumb SecondPreviewPageName="Breeder Dispatch" CurrentPageName="Print Transfer Slip" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/jmb/breederdispatch")}><ArrowLeft className="size-4" />Back</Button>
          <Button type="button" onClick={handlePrint} disabled={!payload}><Printer className="size-4" />Print</Button>
        </div>
      </div>

      {error ? <div className="mx-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {!payload && !error ? <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading transfer slip...</div> : null}

      {payload ? <div className="print-shell mx-4 w-fit bg-white shadow">
        <div ref={printRef} className="a4-page bg-white p-6 text-black">
          <div className="flex items-start gap-4">
            <div className="w-24 shrink-0 text-center">
              <Image src="/images/vitarich.png" alt="Vitarich" width={76} height={76} className="mx-auto h-auto w-[76px]" priority />
              <div className="mt-1 text-[9px] italic">Rich in History. Rich in Experience</div>
            </div>
            <div className="flex-1">
              <div className="text-xl font-bold">VITARICH</div>
              <div className="text-sm">Marilao-San Jose Road, Sta. Rosa 1, Marilao, Bulacan</div>
              <div className="text-sm">Tel No.: 843-3033 Loc 129</div>
              <div className="text-sm">VAT REG: 000-234-398-000</div>
            </div>
            <div className="min-w-56">
              <div className="text-right font-bold">TRANSFER SLIP</div>
              <PrintLine label="DOC NO." value={header?.document_no ?? ""} />
              <PrintLine label="DATE" value={formatDate(header?.dispatch_date)} />
              <PrintLine label="STATUS" value={header?.status ?? ""} />
            </div>
          </div>

          <div className="mt-8 space-y-1">
            <PrintLine label="DELIVERED TO" value={header?.destination ?? ""} wide />
            <PrintLine label="FROM" value={header?.farm_name ?? ""} wide />
            <div className="grid grid-cols-3 gap-5 pt-3"><PrintLine label="HAULER" value={header?.hauler_name ?? ""} wide /><PrintLine label="PLATE NO." value={header?.plate_number ?? ""} wide /><PrintLine label="TRUCK SEAL" value={header?.truck_seal ?? ""} wide /></div>
          </div>

          <div className="mt-7 text-sm">Transferred the following materials and supplies in good order and condition.</div>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead className="bg-gray-300"><tr><th className="border-2 border-black px-2 py-1 text-left">PROD CODE</th><th className="border-2 border-black px-2 py-1 text-left">DESCRIPTION</th><th className="border-2 border-black px-2 py-1 text-left">PROD. DATE</th><th className="border-2 border-black px-2 py-1 text-right">QUANTITY</th><th className="border-2 border-black px-2 py-1 text-left">UNIT</th></tr></thead>
            <tbody>{lineItems.map((item, index) => <tr key={`${item.id ?? 0}-${index}`}><td className="h-7 border-2 border-black px-2">{item.production_code}</td><td className="border-2 border-black px-2">{item.description}</td><td className="whitespace-nowrap border-2 border-black px-2">{formatDate(item.source_date)}</td><td className="border-2 border-black px-2 text-right tabular-nums">{item.production_code ? Number(item.dispatch_qty).toLocaleString() : ""}</td><td className="border-2 border-black px-2">{item.uom}</td></tr>)}</tbody>
          </table>
          <div className="mt-2 flex justify-end gap-5 font-bold"><span>TOTAL:</span><span className="min-w-28 text-right">{totalQty.toLocaleString()}</span></div>

          <div className="mt-4 text-sm"><span className="font-bold">REMARKS: </span>{header?.remarks || "-"}</div>
          <p className="mt-3 text-xs">NOTE: The authorized courier is responsible for loss or damage while the dispatched items are in transit until the transferee acknowledges receipt in the condition specified above.</p>

          <div className="mt-8 grid grid-cols-2 gap-x-14 gap-y-8 text-sm">
            <Signature label="ISSUED BY" caption="Transferor" />
            <Signature label="RECEIVED BY" caption="Transferee" />
            <Signature label="DATE" caption="" />
            <Signature label="DATE" caption="" />
            <Signature label="RECEIVED BY" caption="Authorized Courier" />
            <div className="text-xs"><div>Original - destination / transferee</div><div>Pink - source / transferor</div><div>Yellow - accounting</div><div>Blue - extra copy</div></div>
          </div>
          {header?.status === "Cancelled" ? <div className="cancelled-watermark">CANCELLED</div> : null}
        </div>
      </div> : null}

      <style jsx global>{`
        .a4-page { position: relative; width: 210mm; min-height: 297mm; }
        .cancelled-watermark { position: absolute; inset: 45% 0 auto; transform: rotate(-28deg); text-align: center; font-size: 72px; font-weight: 800; color: rgba(185, 28, 28, .18); }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .print-hidden, [data-sidebar], aside { display: none !important; }
          .print-shell { margin: 0 !important; box-shadow: none !important; }
          .a4-page { margin: 0; box-shadow: none; }
        }
      `}</style>
    </main>
  );
}

function PrintLine({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`flex items-end gap-2 ${wide ? "w-full" : ""}`}><span className="shrink-0 font-bold">{label} :</span><span className="min-h-5 flex-1 border-b-2 border-black px-2 text-right">{value}</span></div>;
}

function Signature({ label, caption }: { label: string; caption: string }) {
  return <div><div>{label} :</div><div className="h-6 border-b-2 border-black" /><div className="text-center text-xs">{caption ? `(${caption})` : ""}</div></div>;
}

// app/a_baja/docdispatch/[docDispatchID]/print/Layout.tsx
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import { Button } from "@/components/ui/button";

import {
  getDocDispatchPrint,
  type DocDispatchPrintItem,
  type DocDispatchPrintPayload,
} from "./api";
import { getDateOnly } from "@/lib/DefaultFunctions";

export default function Layout() {
  const { docDispatchID } = useParams<{ docDispatchID: string }>();
  const [payload, setPayload] = useState<DocDispatchPrintPayload | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "DOC Dispatch - Transfer Slip",
  });

  const getData = async () => {
    if (!docDispatchID) return;
    const res = await getDocDispatchPrint(Number(docDispatchID));
    setPayload(res);
  };

  // ✅ total qty (only real items)
  const totalQty = useMemo(() => {
    const rows = payload?.items ?? [];
    return rows.reduce((sum, r) => sum + (Number(r.qty ?? 0) || 0), 0);
  }, [payload]);

  // ✅ Always 10 rows for printing
  const lineItems = useMemo(() => {
    const rows = payload?.items ?? [];
    const padded: DocDispatchPrintItem[] = [...rows];

    while (padded.length < 12) {
      padded.push({
        dispatch_doc_item_id: 0,
        line_no: padded.length + 1,
        sku_name: "",
        doc_batch_code: "",
        qty: null,
        uom: "",
      });
    }

    return padded.slice(0, 12);
  }, [payload]);

  useEffect(() => {
    getData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docDispatchID]);

  const header = payload?.header;

  return (
    <div>
      <div className="flex items-center justify-between px-4">
        <div className="my-8">
          <Breadcrumb
            FirstPreviewsPageName="Hatchery"
            SecondPreviewPageName="Doc Dispatch"
            CurrentPageName="Print DOC Dispatch"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handlePrint} disabled={!payload}>
            <Printer className="mr-2 size-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-13rem)] overflow-y-auto">
        <div className="bg-white mx-4 rounded-2xl shadow w-fit">
          <div ref={printRef} className="a4-page p-6">
            {/* Header */}
            <div className="flex gap-4">
              {/* LOGO */}
              <div className="w-fit mt-2">
                <img
                  src="/images/vitarich.png"
                  alt="Vitarich"
                  className="h-24 object-contain"
                />
                {/* <div className="italic items-center mt-1">
                  <div className="flex gap-1 italic font-bold leading-[1.2] mx-auto w-fit">
                    {"VITARICH".split("").map((c, i) => (
                      <p key={i}>{c}</p>
                    ))}
                  </div>
                  <div className="text-xs mx-auto w-fit">
                    Rich in History. Rich in Experience
                  </div>
                </div> */}
              </div>

              {/* Company Info */}
              <div className="flex-1">
                <div className="font-bold text-xl mt-1">VITARICH</div>
                <div className="-mt-1 text-sm">
                  Address:{" "}
                  <span>
                    Marilao-San Jose Road, Sta. Rosa 1, Marilao Bulacan
                  </span>
                </div>
                <div className="-mt-1 text-sm">
                  Tel No.: <span>843-3033 Loc 129</span>
                </div>
                <div className="-mt-1 text-sm">
                  Fax No.: <span>843-3033 Loc 400</span>
                </div>
                <div className="-mt-1 text-sm">
                  VAT REG: <span>000-234-398-000</span>
                </div>
              </div>

              {/* Doc Info */}
              <div className="min-w-55">
                <div className="font-bold whitespace-nowrap text-right">
                  TRANSFER SLIP
                </div>

                <div className="flex whitespace-nowrap gap-2">
                  <div className="w-17.5">DOC NO.</div>
                  <div className="border-b-2 border-black w-full text-right">
                    {header?.dr_no ?? ""}
                  </div>
                </div>

                <div className="flex whitespace-nowrap gap-2">
                  <div className="w-17.5">DATE</div>
                  <div className="border-b-2 border-black w-full text-right">
                    <span className="mx-1">
                      {getDateOnly(header?.doc_date ?? "")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivered To / Address / From */}
            <div className="mt-8">
              <div className="flex">
                <div className="w-40 font-bold">DELIVERED TO :</div>
                <div className="w-full border-b-2 border-black px-2">
                  {header?.farm_name ?? ""}
                </div>
              </div>

              <div className="flex">
                <div className="w-40 font-bold">ADDRESS :</div>
                <div className="w-full border-b-2 border-black px-2">{""}</div>
              </div>

              <div className="flex mt-5">
                <div className="w-40 font-bold">FROM :</div>
                <div className="w-full border-b-2 border-black px-2">{""}</div>
              </div>
            </div>

            {/* Items */}
            <div className="mt-8">
              <div>
                Transferred the following materials and supplies in good order
                and condition.
              </div>

              <table className="w-full mt-2 border-collapse">
                <thead className="bg-gray-300">
                  <tr>
                    <th className="whitespace-nowrap border-2 border-black px-4 text-left">
                      PROD CODE
                    </th>
                    <th className="whitespace-nowrap border-2 border-black w-full text-left">
                      DESCRIPTION
                    </th>
                    <th className="whitespace-nowrap border-2 border-black px-4 text-right">
                      QUANTITY
                    </th>
                    <th className="whitespace-nowrap border-2 border-black px-4 text-left">
                      UNIT
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {lineItems.map((item, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap border-2 border-black px-4">
                        {item.sku_name || ""}
                      </td>

                      <td className="whitespace-nowrap border-2 border-black w-full px-2">
                        {item.doc_batch_code || ""}
                      </td>

                      <td className="whitespace-nowrap border-2 border-black px-4 text-right">
                        {item.sku_name
                          ? Number(item.qty ?? 0).toLocaleString()
                          : ""}
                      </td>

                      <td className="whitespace-nowrap border-2 border-black px-4">
                        {item.uom || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ✅ TOTAL QTY after table */}
              <div className="flex justify-end mt-2">
                <div className="flex gap-2 font-bold">
                  <div>TOTAL:</div>
                  <div className="min-w-27.5 text-right">
                    {Number(totalQty ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <p className="text-sm mt-2">
                NOTE: Authorized courier shall be responsible for any loss or
                damage of the materials & supplies while in transit & such
                liability shall be extinguished only at the time that authorized
                transferee acknowledges receipt of the materials & supplies on
                the same condition as specified above.
              </p>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-2 mt-6">
                <div>
                  <div>ISSUED BY :</div>
                  <div className="border-b-2 border-black text-center">
                    {header?.fullname || header?.created_by_display || ""}
                  </div>
                  <div className="mx-auto w-fit">(Transferor)</div>
                </div>

                <div>
                  <div>RECEIVED BY :</div>
                  <div className="border-b-2 border-black text-center">-</div>
                  <div className="mx-auto w-fit">(Transferee)</div>
                </div>

                <div>
                  <div className="pb-4">DATE :</div>
                  <div className="border-t-2 border-black" />
                </div>

                <div>
                  <div className="pb-4">DATE :</div>
                  <div className="border-t-2 border-black" />
                </div>

                <div>
                  <div className="pb-4">RECEIVED BY :</div>
                  <div className="border-t-2 border-black text-center">
                    (Authorized Courier)
                  </div>
                </div>

                <div className="text-sm">
                  <div className="-mt-1">
                    Original - destination / transferee
                  </div>
                  <div className="-mt-1">Pink - source / transferor</div>
                  <div className="-mt-1">Yellow - accounting</div>
                  <div className="-mt-1">Blue - extra copy</div>
                </div>
              </div>
            </div>
          </div>
          {/* Print CSS */}
          <style jsx global>{`
            .a4-page {
              width: 210mm;
              min-height: 297mm;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .a4-page {
                margin: 0;
                box-shadow: none;
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}

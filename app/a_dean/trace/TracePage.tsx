// "use client";

// import { db } from "@/lib/Supabase/supabaseClient";
// import { useParams } from "next/navigation";
// import { useEffect, useState } from "react";
// import ReactFlow, {
//   Background,
//   Controls,
//   Node,
//   Edge
// } from "reactflow";
// import "reactflow/dist/style.css";

// export default function TracePage() {
//   const { ref } = useParams();

//   const [nodes, setNodes] = useState<Node[]>([]);
//   const [edges, setEdges] = useState<Edge[]>([]);

//   useEffect(() => {
//     if (ref) loadTrace();
//   }, [ref]);

//   async function loadTrace() {
//     const { data, error } = await db.rpc(
//       "trace_lifecycle_nodes",
//       { start_ref: ref }
//     );

//     if (error) {
//       console.log(error);
//       return;
//     }

//     if (!data) return;

//     // 🧭 Sort by time (important)
//     const sorted = [...data].sort(
//       (a: any, b: any) =>
//         new Date(a.created_at).getTime() -
//         new Date(b.created_at).getTime()
//     );

//     console.log({ sorted });

//     // ⭐ Build Nodes
//     const graphNodes: Node[] = sorted.map(
//       (n: any, i: number) => ({
//         id: `${n.stage}-${n.doc_id}`, // unique
//         position: { x: i * 260, y: 120 },
//         data: {
//           label: `${n.stage}\nRef: ${n.ref}`
//         },
//         type: "default"
//       })
//     );

//     setNodes(graphNodes);

//     // ⭐ Simple chronological edges
//     const graphEdges: Edge[] = graphNodes
//       .slice(1)
//       .map((n, i) => ({
//         id: `e-${i}`,
//         source: graphNodes[i].id,
//         target: n.id
//       }));

//     setEdges(graphEdges);
//   }

//   return (
//     <div style={{ width: "100%", height: "90vh" }}>
//       <ReactFlow nodes={nodes} edges={edges}>
//         <Background />
//         <Controls />
//       </ReactFlow>
//     </div>
//   );
// }


"use client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { db } from "@/lib/Supabase/supabaseClient";
import { RefreshCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TraceTimeline() {
    const { setValue, getValue } = useGlobalContext()
    const [ref, setref] = useState("")
    const [loading, setLoading] = useState(false)
    // const { ref } = useParams();
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        setref(getValue("traceBreederRef"))
    }, []);
    useEffect(() => {
        if (ref === '') return
        if (ref === "") return
        console.log({ ref })
        loadTrace()
    }, [ref]);
    async function loadTrace() {
        setLoading(true)
        const { data } = await db.rpc(
            "trace_lifecycle_nodes",
            { start_ref: decodeURIComponent(ref as string) }
        );

        if (!data) return;

        const sorted = [...data].sort(
            (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
        );
        setLoading(!true)

        setItems(sorted);
    }

    return (


        <div className="mt-8 px-4">
            <Breadcrumb
                CurrentPageName="Transaction Trace Log "
            />
            <Card>
                {loading ? (
                    <div className="mx-auto p-6 h-full max-h-[calc(100vh-12rem)] overflow-y-auto space-y-4">

                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-3">

                                {/* Timeline */}
                                <div className="flex flex-col items-center">
                                    <Skeleton className="w-3 h-3 rounded-full" />

                                    {i !== 5 && (
                                        <Skeleton className="w-px flex-1 min-h-[60px]" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="pb-6 space-y-2 w-full">
                                    <Skeleton className="h-5 w-[220px]" />
                                    <Skeleton className="h-4 w-[180px]" />
                                    <Skeleton className="h-3 w-[140px]" />
                                </div>
                            </div>
                        ))}

                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        No trace data found.
                    </div>
                ) : null}
                <div className=" mx-auto p-6  h-full max-h-[calc(100vh-12rem)] overflow-y-auto">
                    {items.map((item, i) => (
                        <div key={i} className="flex gap-2">
                            {/* Timeline dot */}
                            <div className="flex flex-col items-center">
                                <div className="w-3 h-3 rounded-full bg-primary mt-1" />
                                {i !== items.length - 1 && (
                                    <div className="w-px flex-1 bg-border" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="pb-6">
                                <div className="font-semibold">
                                    {item.stage}
                                </div>

                                <div className="text-sm text-muted-foreground">
                                    Ref: {item.ref}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    {new Date(item.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
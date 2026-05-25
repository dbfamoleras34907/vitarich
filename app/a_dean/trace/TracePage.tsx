"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { Modal } from "@/lib/Moda";
import { db } from "@/lib/Supabase/supabaseClient";
import {
    Archive,
    ArrowLeftRight,
    ClipboardCheck,
    Egg,
    Package,
    Settings2,
    Thermometer,
} from "lucide-react";
import { useEffect, useState } from "react";
import ReactFlow, {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    useEdgesState,
    useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

const icons: Record<string, any> = {
    RECEIVING: ClipboardCheck,
    CLASSIFICATION: Archive,
    STORAGE: Package,
    PRE_WARMING: Thermometer,
    SETTER: Settings2,
    TRANSFER: ArrowLeftRight,
    HATCHER: Egg,
};

function TraceNode({
    data,
}: {
    data: any;
}) {
    const Icon = icons[data.stage] ?? ClipboardCheck;



    return (
        <>
            <Handle
                type="target"
                position={Position.Left}
            />

            <Card
                onClick={(e) => {
                    e.stopPropagation();
                    data.onClick?.();
                }}
                className="
          w-[260px]
          rounded-[28px]
          border-0
          bg-white
          shadow-md
          hover:shadow-xl
          hover:scale-[1.02]
          transition-all
          duration-300
          p-4
          cursor-pointer
          active:scale-[0.98]
        "
            >
                <div className="flex gap-4 items-start">
                    <div
                        className="
              h-14 w-14
              rounded-2xl
              bg-primary/10
              flex items-center justify-center
              shrink-0
            "
                    >
                        <Icon
                            size={24}
                            className="text-primary"
                        />
                    </div>

                    <div className="flex-1">
                        <div className="font-semibold text-sm tracking-wide">
                            {data.stage}
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">
                            Ref: {data.ref}
                        </div>

                        <div className="text-[11px] text-muted-foreground mt-3">
                            {new Date(
                                data.created_at
                            ).toLocaleString()}
                        </div>
                    </div>
                </div>
            </Card>

            <Handle
                type="source"
                position={Position.Right}
            />
        </>
    );
}

const nodeTypes = {
    trace: TraceNode,
};

export default function TraceTimeline() {
    const [modalState, setmodalState] = useState(false)
    const [cardinfo, setcardinfo] = useState({
        title: "",
        ref: "",
        id: "",
        date: ""
    })
    const { getValue } =
        useGlobalContext();

    const [ref, setRef] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [items, setItems] =
        useState<any[]>([]);

    const [
        nodes,
        setNodes,
        onNodesChange,
    ] = useNodesState([]);

    const [
        edges,
        setEdges,
        onEdgesChange,
    ] = useEdgesState([]);

    useEffect(() => {
        setRef(
            getValue("traceBreederRef")
        );
    }, []);

    useEffect(() => {
        if (!ref) return;
        loadTrace();
    }, [ref]);

    async function loadTrace() {
        try {
            setLoading(true);

            const { data } =
                await db.rpc(
                    "trace_lifecycle_nodes",
                    {
                        start_ref:
                            decodeURIComponent(
                                ref
                            ),
                    }
                );

            if (!data) return;

            const sorted = [
                ...data,
            ].sort(
                (a, b) =>
                    new Date(
                        a.created_at
                    ).getTime() -
                    new Date(
                        b.created_at
                    ).getTime()
            );

            setItems(sorted);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!items.length) return;

        const tempNodes: any[] = [];
        const tempEdges: any[] = [];

        const receiving =
            items.find(
                (x) =>
                    x.stage ===
                    "RECEIVING"
            );

        if (!receiving) return;

        const rootId = `receiving-${receiving.doc_id}`;

        // GROUP BRANCHES
        const branches =
            new Map<string, any[]>();

        items.forEach((item) => {
            if (
                item.stage ===
                "RECEIVING"
            )
                return;

            const branch =
                item.ref.match(
                    /CL\d+/
                )?.[0] ??
                item.ref;

            if (!branches.has(branch)) {
                branches.set(
                    branch,
                    []
                );
            }

            branches.get(branch)?.push(item);
        });

        const branchArray = [...branches.entries(),];

        const centerIndex = Math.floor(branchArray.length / 2);

        // ROOT NODE
        tempNodes.push({
            id: rootId,
            type: "trace",
            draggable: true,
            position: {
                x: 0,
                y: 320,
            },
            data: {
                ...receiving,
                onClick: () => {
                    console.log(receiving);
                    setcardinfo({
                        title: receiving.stage,
                        ref: receiving.ref,
                        id: receiving.doc_id,
                        date: new Date(receiving.created_at).toLocaleString()
                    });
                    setmodalState(true);
                },
            },
        });

        const horizontalSpacing =
            300;

        const verticalSpacing =
            180;

        branchArray.forEach(
            (
                [_, records],
                branchIndex
            ) => {
                let prevId =
                    rootId;

                records.sort(
                    (
                        a: any,
                        b: any
                    ) =>
                        new Date(
                            a.created_at
                        ).getTime() -
                        new Date(
                            b.created_at
                        ).getTime()
                );

                records.forEach(
                    (
                        record: any,
                        level: number
                    ) => {
                        const id = `${record.stage}-${record.doc_id}`;

                        tempNodes.push({
                            id,
                            type: "trace",
                            draggable: true,
                            position: {
                                x:
                                    level *
                                    horizontalSpacing +
                                    300,

                                y:
                                    320 +
                                    (branchIndex -
                                        centerIndex) *
                                    verticalSpacing,
                            },
                            data: {
                                ...record,
                                onClick: () => {
                                    console.log(record);
                                    setcardinfo({
                                        title: record.stage,
                                        ref: record.ref,
                                        id: record.doc_id,
                                        date: new Date(record.created_at).toLocaleString()

                                    });
                                    setmodalState(true);
                                },
                            },
                        });

                        tempEdges.push({
                            id: `${prevId}-${id}`,
                            source:
                                prevId,
                            target: id,
                            animated: true,
                            markerEnd: {
                                type:
                                    MarkerType.ArrowClosed,
                            },
                            style: {
                                strokeWidth: 2,
                            },
                        });

                        prevId = id;
                    }
                );
            }
        );

        setNodes(tempNodes);
        setEdges(tempEdges);
    }, [items]);

    return (
        <div className="mt-8 px-4">
            <Breadcrumb
                CurrentPageName="Transaction Trace Log"
                FirstPreviewsPageName="Admin"
            />

            <div className="pb-4" />

            <Card className="overflow-hidden border-0 shadow-md">
                {loading ? (
                    <div className="space-y-4 p-6">
                        {Array.from({
                            length: 6,
                        }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className="h-24 w-full rounded-2xl"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-[75vh] w-full bg-slate-50">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={
                                nodeTypes
                            }
                            onNodesChange={
                                onNodesChange
                            }
                            onEdgesChange={
                                onEdgesChange
                            }
                            defaultViewport={{
                                x: 0,
                                y: 0,
                                zoom: 0.8,
                            }}
                            snapToGrid
                            snapGrid={[
                                20, 20,
                            ]}
                        >
                            <Background
                                gap={20}
                            />
                            <MiniMap
                                zoomable
                                pannable
                            />
                            <Controls />
                        </ReactFlow>
                    </div>



                )}
            </Card>

            <Modal
                open={modalState}
                onOpenChange={setmodalState}
                title={cardinfo.title}
            >


                <div className="space-y-4 p-4">
                    <p className="text-sm text-muted-foreground">
                        <strong>ID:</strong> {cardinfo.id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        <strong>Reference:</strong> {cardinfo.ref}
                    </p>

                    <p className="text-sm text-muted-foreground">
                        <strong>Date:</strong> {cardinfo.date}
                    </p>
                </div>


                <div>
                    <Button
                        onClick={() => { }}
                        className="bg-red-400 text-white mx-4 hover:bg-red-400/70" size={"xs"}>
                        Cancel
                    </Button>
                    <div className="float-right  mb-2 mx-3 flex gap-1">



                        <Button
                            onClick={() => {
                                cardinfo.title === "CLASSIFICATION" && cardinfo.id && window.open(`/jmb/hatcheryclassi/view/${cardinfo.id}`, "_blank")
                                cardinfo.title === "STORAGE" && cardinfo.id && window.open(`/jmb/eggstorage/view/${cardinfo.id}`, "_blank")
                                cardinfo.title === "PRE_WARMING" && cardinfo.id && window.open(`/jmb/prewarmingv2/view/${cardinfo.id}`, "_blank")
                                cardinfo.title === "SETTER" && cardinfo.id && window.open(`/jmb/eggsetter/view/${cardinfo.id}`, "_blank")
                                cardinfo.title === "TRANSFER" && cardinfo.id && window.open(`/jmb/eggtransferv2/view/${cardinfo.id}`, "_blank")
                                cardinfo.title === "HATCHER" && cardinfo.id && window.open(`/jmb/egghatcherv2/view/${cardinfo.id}`, "_blank")
                                cardinfo.title === "PULLOUT" && cardinfo.id && window.open(`/jmb/chickpulloutv2/view/${cardinfo.id}`, "_blank")
                            }}
                            className="bg-black text-white  hover:bg-black/70" size={"xs"}>
                            View details
                        </Button>

                        <Button
                            onClick={() => setmodalState(false)}
                            className="bg-black text-white  hover:bg-black/70" size={"xs"}>
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { Modal } from "@/lib/Moda";
import { db } from "@/lib/Supabase/supabaseClient";
import {
    Archive,
    ArrowLeftRight,
    Ban,
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
import { reverseChickGrading, reverseChickPullout, reverseClassification, reverseDispatch, reverseDisposal, reverseHatcher, reversePreWarming, reverseReceiving, reverseSetter, reverseStorage, reverseTransfer } from "./api";
import { useConfirm } from "@/lib/ConfirmProvider";
import { toast } from "sonner";

const icons: Record<string, any> = {
    RECEIVING: ClipboardCheck,
    CLASSIFICATION: Archive,
    STORAGE: Package,
    PRE_WARMING: Thermometer,
    SETTER: Settings2,
    TRANSFER: ArrowLeftRight,
    HATCHER: Egg,
};

const CancelBackground = () => {
    return (
        <Ban
            className="absolute bg-red-100/10 rounded-2xl w-full right-0 top-1/2 -translate-y-1/2 text-red-500/10 pointer-events-none"
            strokeWidth={2}
            size={180}
        />
    )
}
function TraceNode({ data, }: { data: any; }) {
    const Icon = icons[data.stage] ?? ClipboardCheck;

    return (
        <>
            <Handle type="target" position={Position.Left} />
            {/* <Button onClick={() => console.log({ data })}>check data</Button> */}
            <Card onClick={(e) => { e.stopPropagation(); data.onClick?.(); }}
                className=" w-[260px] rounded-[28px] border-0  bg-white  shadow-md  hover:shadow-xl  hover:scale-[1.02]  transition-all  duration-300  p-4  cursor-pointer  active:scale-[0.98] not-only: "
            >
                <div className="flex gap-4 items-start relative overflow-hidden">
                    {/* Background cancel Icon */}
                    {data.stage === "DISPOSAL" && data.extra.void && (<CancelBackground />)}
                    {data.stage === "DISPATCH" && !data.extra.is_active && (<CancelBackground />)}
                    {data.stage === "CHICK_GRADING" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "PULLOUT" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "HATCHER" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "TRANSFER" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "SETTER" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "STORAGE" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "CLASSIFICATION" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "RECEIVING" && data.extra.void == 0 && (<CancelBackground />)}
                    {data.stage === "PRE_WARMING" && !data.extra.is_active && (<CancelBackground />)}

                    {/* Foreground Content */}
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon size={24} className="text-primary" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm tracking-wide bg-gray-600 text-white px-2 rounded-md w-fit">
                            {data.stage}
                        </div>
                        <div className="mt-1">
                            ID: {data.doc_id}
                        </div>
                        <div className="mt-2 whitespace-normal w-fit">
                            {new Date(data.created_at).toDateString()}
                        </div>

                        <div className="whitespace-normal w-fit">
                            {new Date(data.created_at).toLocaleTimeString()}
                        </div>
                        <div className="mt-1">
                            Ref: {data.ref}
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

const nodeTypes = { trace: TraceNode, };

export default function TraceTimeline() {
    const [modalState, setmodalState] = useState(false)
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const confirm = useConfirm()

    const [cardinfo, setcardinfo] = useState({
        title: "",
        ref: "",
        id: "",
        date: ""
    })
    const { getValue } = useGlobalContext();

    const [ref, setRef] = useState("");

    const [loading, setLoading] = useState(false);

    const [items, setItems] = useState<any[]>([]);

    const [nodes, setNodes, onNodesChange,] = useNodesState([]);

    const [edges, setEdges, onEdgesChange,] = useEdgesState([]);


    function preventOverlap(
        inputNodes: any[]
    ) {
        const CARD_WIDTH = 190;
        const CARD_HEIGHT = 50;

        const GAP_X = 10;
        const GAP_Y = 10;

        const nodes = inputNodes.map(
            (node) => ({
                ...node,
                position: { ...node.position, },
                data: { ...node.data, },
            })
        );

        const isOverlapping = (a: any, b: any) => {
            return (Math.abs(a.position.x - b.position.x) < CARD_WIDTH + GAP_X && Math.abs(a.position.y - b.position.y) < CARD_HEIGHT + GAP_Y);
        };

        const occupied = new Set<string>();

        const getKey = (x: number, y: number) =>
            `${Math.round(x)}-${Math.round(y)}`;

        nodes.forEach((node) => {
            let { x, y, } = node.position;

            let moved = true;
            let tries = 0;

            while (moved && tries < 100) {
                moved = false;
                tries++;
                for (const other of nodes) {
                    if (other.id === node.id) continue;
                    if (isOverlapping({
                        position: { x, y, },
                    }, other)) {
                        moved = true;
                        y += CARD_HEIGHT + GAP_Y;

                        if (occupied.has(getKey(x, y))) {
                            x += CARD_WIDTH + GAP_X;
                        }
                        break;
                    }
                }
            }

            node.position = {
                x,
                y,
            };

            occupied.add(
                getKey(x, y)
            );
        });

        return nodes;
    }


    function autoArrangeCards() {
        const horizontalSpacing = 300;
        const verticalSpacing = 180;

        const groupedByY = new Map<number, any[]>();

        nodes.forEach((node) => {
            const yGroup =
                Math.round(
                    node.position.y /
                    verticalSpacing
                ) * verticalSpacing;

            if (
                !groupedByY.has(yGroup)
            ) {
                groupedByY.set(
                    yGroup,
                    []
                );
            }

            groupedByY
                .get(yGroup)
                ?.push(node);
        });

        const arrangedNodes = [
            ...groupedByY.entries(),
        ].flatMap(
            ([y, rowNodes]) =>
                rowNodes.map(
                    (node, index) => ({
                        ...node,
                        position: {
                            x: index * horizontalSpacing,
                            y,
                        },
                    })
                )
        );

        const noOverlapNodes =
            preventOverlap(
                arrangedNodes
            );

        setNodes(noOverlapNodes);

        setTimeout(() => {
            reactFlowInstance?.fitView({
                padding: 0.2,
                duration: 800,
            });
        }, 100);
    }



    async function voidTransaction(id: number, title: string) {
        try {

            if (!id) return;

            // const confirmVoid = await confirmx(`Void ${title} #${id}?`);

            const confirmVoid = await confirm({
                title: `Void ${title} #${id}?`,
                description: "Are you sure you want to void this transaction? This action cannot be undone. All related transactions will also be voided.",
                confirmText: "Confirm",
                cancelText: "Cancel",
            });
            if (!confirmVoid) return;

            const reverseHandlers: Record<
                string, {
                    action: (id: number) => Promise<any>;
                    error: string;
                }
            > = {
                DISPOSAL: { action: reverseDisposal, error: "Failed to reverse disposal", },
                DISPATCH: { action: reverseDispatch, error: "Failed to reverse dispatch", },
                CHICK_GRADING: { action: reverseChickGrading, error: "Failed to reverse chick grading", },
                PULLOUT: { action: reverseChickPullout, error: "Failed to reverse chick pullout", },
                HATCHER: { action: reverseHatcher, error: "Failed to reverse hatcher", },
                TRANSFER: { action: reverseTransfer, error: "Failed to reverse transfer", },
                SETTER: { action: reverseSetter, error: "Failed to reverse setter", },
                PRE_WARMING: { action: reversePreWarming, error: "Failed to reverse pre-warming", },
                STORAGE: { action: reverseStorage, error: "Failed to reverse storage", },
                CLASSIFICATION: { action: reverseClassification, error: "Failed to reverse classification", },
                RECEIVING: { action: reverseReceiving, error: "Failed to reverse receiving", },
            };

            const handler = reverseHandlers[title];

            if (handler) {
                const result = await handler.action(Number(id));

                console.log({ result });

                if (!result?.success) {
                    throw new Error(
                        result?.message ?? handler.error
                    );
                }
            }

            toast("Transaction reversed successfully");
            setmodalState(false);

            setNodes((prev) =>
                prev.map((node: any) => {
                    if (
                        node.data.doc_id === id &&
                        node.data.stage === title
                    ) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                extra: {
                                    ...node.data.extra,
                                    ...(title === "DISPOSAL" && { void: true, }),
                                    ...(title === "DISPATCH" && { is_active: false, }),
                                    ...(title === "PRE_WARMING" && { is_active: false, }),
                                    ...(["CHICK_GRADING", "PULLOUT", "HATCHER", "TRANSFER", "SETTER", "STORAGE", "CLASSIFICATION", "RECEIVING",
                                    ].includes(title) && {
                                        void: 0,
                                    }),
                                },
                            },
                        };
                    }

                    return node;
                })
            );

        } catch (error: any) {

            alert(
                error?.message ??
                "Something went wrong"
            );
        }
    }


    useEffect(() => {
        setRef(getValue("traceBreederRef"));
    }, []);

    useEffect(() => {
        if (!ref) return;
        loadTrace();
    }, [ref]);

    async function loadTrace() {
        try {
            setLoading(true);

            const { data } = await db.rpc("trace_lifecycle_nodes", { start_ref: decodeURIComponent(ref), });

            if (!data) return;
            const sorted = [...data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const seen = new Set();
            const filtered = sorted.filter(item => {
                const key = `${item.stage}-${item.doc_id}`;

                if (seen.has(key)) return false;

                seen.add(key);
                return true;
            });

            setItems(filtered);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!items.length) return;

        const tempNodes: any[] = [];
        const tempEdges: any[] = [];

        const receiving = items.find(
            (x) => x.stage === "RECEIVING"
        );

        if (!receiving) return;

        const rootId = `RECEIVING-${receiving.doc_id}-root`;

        const stageParentMap: Record<string, string[]> = {
            CLASSIFICATION: ["RECEIVING",],
            STORAGE: ["CLASSIFICATION",],
            PRE_WARMING: ["STORAGE",],
            SETTER: ["PRE_WARMING",],
            TRANSFER: ["SETTER",],
            HATCHER: ["TRANSFER",],
            PULLOUT: ["HATCHER",],
            CHICK_GRADING: ["PULLOUT",],
            DISPATCH: ["CHICK_GRADING",],
            DISPOSAL: ["CHICK_GRADING",],
        };


        const stageLevelMap: Record<
            string,
            number
        > = {
            RECEIVING: 0,
            CLASSIFICATION: 1,
            STORAGE: 2,
            PRE_WARMING: 3,
            SETTER: 4,
            TRANSFER: 5,
            HATCHER: 6,
            PULLOUT: 7,
            CHICK_GRADING: 8,
            DISPATCH: 9,
            DISPOSAL: 9,
        };

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
                    setcardinfo({
                        title:
                            receiving.stage,
                        ref:
                            receiving.ref,
                        id:
                            receiving.doc_id,
                        date: new Date(
                            receiving.created_at
                        ).toLocaleString(),
                    });

                    setmodalState(true);
                },
            },
        });

        const branches = new Map<string, any[]>();

        console.log({ items })
        items.forEach((item) => {
            if (
                item.stage === "RECEIVING"
            )
                return;

            const branch =
                item.ref.match(/CL\d+/)?.[0] ??
                item.ref;

            if (
                !branches.has(branch)
            ) { branches.set(branch, []); }
            branches
                .get(branch)!
                .push(item);
        });

        const branchArray = [
            ...branches.entries(),
        ];

        const centerIndex = Math.floor(branchArray.length / 2);

        const horizontalSpacing = 300;

        const verticalSpacing = 180;

        branchArray.forEach(([_, records], branchIndex) => {
            records.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            const stageMap = new Map<string, string[]>();
            records.forEach((record, index) => {
                const id = `${record.stage}-${record.doc_id}-b${branchIndex}-i${index}`;
                const stageIndex = stageLevelMap[record.stage] ?? 0;
                const sameStageCount = stageMap.get(record.stage)?.length ?? 0;

                tempNodes.push({
                    id, type: "trace", draggable: true, position: {
                        x: stageIndex * horizontalSpacing + 300,
                        y: 320 + (branchIndex - centerIndex) * verticalSpacing + sameStageCount * 90,
                    },
                    data: {
                        ...record,
                        onClick:
                            () => {
                                setcardinfo(
                                    {
                                        title: record.stage,
                                        ref: record.ref,
                                        id: record.doc_id, // Safely passes the real ID to your modal mapping
                                        date: new Date(
                                            record.created_at
                                        ).toLocaleString(),
                                    }
                                );

                                setmodalState(
                                    true
                                );
                            },
                    },
                });

                // FIND PARENT
                let parentId = rootId;

                const parentStages = stageParentMap[record.stage] ?? [];

                for (const stage of parentStages) {
                    const possibleParents =
                        stageMap.get(stage);

                    if (possibleParents?.length) {
                        parentId = possibleParents[possibleParents.length - 1];
                        break;
                    }
                }

                tempEdges.push({
                    id: `${parentId}-${id}`, source: parentId, target: id, animated: true, markerEnd: {
                        type:
                            MarkerType.ArrowClosed,
                    },
                    style: { strokeWidth: 2, },
                });

                if (!stageMap.has(record.stage)) {
                    stageMap.set(record.stage, []
                    );
                }
                stageMap.get(record.stage)!.push(id);
            }
            );
        }
        );
        const cleanNodes = preventOverlap(tempNodes);
        setNodes(cleanNodes);
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
                    <div className="h-[calc(100vh-240px)] w-full bg-slate-50 relative">
                        <Button onClick={() => console.log({ nodes })}> check </Button >
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onInit={setReactFlowInstance}
                            defaultViewport={{
                                x: 0,
                                y: 0,
                                zoom: 0.8,
                            }}
                            snapToGrid
                            snapGrid={[20, 20]}
                        >
                            <Background gap={20} />
                            <MiniMap zoomable pannable />
                            <Controls />
                        </ReactFlow>
                    </div >
                )
                }
            </Card >

            <Modal
                open={modalState}
                onOpenChange={setmodalState}
                title={cardinfo.title}
            >
                <div className="space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>ID</Label>
                            <Input value={cardinfo.id} readOnly />
                        </div>

                        <div className="grid gap-2">
                            <Label>Date</Label>
                            <Input value={cardinfo.date} readOnly />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Reference</Label>
                        <Input value={cardinfo.ref} readOnly />
                    </div>

                    <div className="grid gap-2">
                        <Label>Remarks</Label>
                        <textarea readOnly className="border rounded bg-white shadow" />
                    </div>

                </div>

                <div>
                    <Button
                        size={"xs"}
                        className="mx-3"
                        variant={"destructive"}
                        onClick={() => voidTransaction(Number(cardinfo.id), cardinfo.title)}>
                        Void Transaction
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
        </div >
    );
}
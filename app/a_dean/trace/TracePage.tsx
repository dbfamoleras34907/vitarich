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
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
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
                position: {
                    ...node.position,
                },
                data: {
                    ...node.data,
                },
            })
        );

        const isOverlapping = (
            a: any,
            b: any
        ) => {
            return (
                Math.abs(
                    a.position.x -
                    b.position.x
                ) <
                CARD_WIDTH + GAP_X &&
                Math.abs(
                    a.position.y -
                    b.position.y
                ) <
                CARD_HEIGHT +
                GAP_Y
            );
        };

        const occupied = new Set<
            string
        >();

        const getKey = (
            x: number,
            y: number
        ) =>
            `${Math.round(
                x
            )}-${Math.round(y)}`;

        nodes.forEach((node) => {
            let {
                x,
                y,
            } = node.position;

            let moved = true;
            let tries = 0;

            while (
                moved &&
                tries < 100
            ) {
                moved = false;
                tries++;

                for (const other of nodes) {
                    if (
                        other.id ===
                        node.id
                    )
                        continue;

                    if (
                        isOverlapping(
                            {
                                position: {
                                    x,
                                    y,
                                },
                            },
                            other
                        )
                    ) {
                        moved = true;

                        // prefer vertical shift first
                        y +=
                            CARD_HEIGHT +
                            GAP_Y;

                        // if too crowded,
                        // move right
                        if (
                            occupied.has(
                                getKey(
                                    x,
                                    y
                                )
                            )
                        ) {
                            x +=
                                CARD_WIDTH +
                                GAP_X;
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

        const groupedByY =
            new Map<number, any[]>();

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
                            x:
                                index *
                                horizontalSpacing,
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

    // useEffect(() => {
    //     if (!items.length) return;

    //     const tempNodes: any[] = [];
    //     const tempEdges: any[] = [];

    //     const receiving =
    //         items.find(
    //             (x) =>
    //                 x.stage ===
    //                 "RECEIVING"
    //         );

    //     if (!receiving) return;

    //     const rootId = `receiving-${receiving.doc_id}`;

    //     // GROUP BRANCHES
    //     const branches =
    //         new Map<string, any[]>();

    //     items.forEach((item) => {
    //         if (
    //             item.stage ===
    //             "RECEIVING"
    //         )
    //             return;

    //         const branch =
    //             item.ref.match(
    //                 /CL\d+/
    //             )?.[0] ??
    //             item.ref;

    //         if (!branches.has(branch)) {
    //             branches.set(
    //                 branch,
    //                 []
    //             );
    //         }

    //         branches.get(branch)?.push(item);
    //     });

    //     const branchArray = [...branches.entries(),];

    //     const centerIndex = Math.floor(branchArray.length / 2);

    //     // ROOT NODE
    //     tempNodes.push({
    //         id: rootId,
    //         type: "trace",
    //         draggable: true,
    //         position: {
    //             x: 0,
    //             y: 320,
    //         },
    //         data: {
    //             ...receiving,
    //             onClick: () => {
    //                 console.log(receiving);
    //                 setcardinfo({
    //                     title: receiving.stage,
    //                     ref: receiving.ref,
    //                     id: receiving.doc_id,
    //                     date: new Date(receiving.created_at).toLocaleString()
    //                 });
    //                 setmodalState(true);
    //             },
    //         },
    //     });

    //     const horizontalSpacing =
    //         300;

    //     const verticalSpacing =
    //         180;

    //     branchArray.forEach(
    //         (
    //             [_, records],
    //             branchIndex
    //         ) => {
    //             let prevId =
    //                 rootId;

    //             records.sort(
    //                 (
    //                     a: any,
    //                     b: any
    //                 ) =>
    //                     new Date(
    //                         a.created_at
    //                     ).getTime() -
    //                     new Date(
    //                         b.created_at
    //                     ).getTime()
    //             );

    //             records.forEach(
    //                 (
    //                     record: any,
    //                     level: number
    //                 ) => {
    //                     const id = `${record.stage}-${record.doc_id}`;

    //                     tempNodes.push({
    //                         id,
    //                         type: "trace",
    //                         draggable: true,
    //                         position: {
    //                             x:
    //                                 level *
    //                                 horizontalSpacing +
    //                                 300,

    //                             y:
    //                                 320 +
    //                                 (branchIndex -
    //                                     centerIndex) *
    //                                 verticalSpacing,
    //                         },
    //                         data: {
    //                             ...record,
    //                             onClick: () => {
    //                                 console.log(record);
    //                                 setcardinfo({
    //                                     title: record.stage,
    //                                     ref: record.ref,
    //                                     id: record.doc_id,
    //                                     date: new Date(record.created_at).toLocaleString()

    //                                 });
    //                                 setmodalState(true);
    //                             },
    //                         },
    //                     });

    //                     tempEdges.push({
    //                         id: `${prevId}-${id}`,
    //                         source:
    //                             prevId,
    //                         target: id,
    //                         animated: true,
    //                         markerEnd: {
    //                             type:
    //                                 MarkerType.ArrowClosed,
    //                         },
    //                         style: {
    //                             strokeWidth: 2,
    //                         },
    //                     });

    //                     prevId = id;
    //                 }
    //             );
    //         }
    //     );

    //     setNodes(tempNodes);
    //     setEdges(tempEdges);
    // }, [items]);

    useEffect(() => {
        if (!items.length) return;

        const tempNodes: any[] = [];
        const tempEdges: any[] = [];

        const receiving = items.find(
            (x) => x.stage === "RECEIVING"
        );

        if (!receiving) return;

        const rootId = `receiving-${receiving.doc_id}`;

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
        // ROOT
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




        // GROUP BY BRANCH
        const branches =
            new Map<string, any[]>();
        console.log({ items })
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

            if (
                !branches.has(branch)
            ) {
                branches.set(
                    branch,
                    []
                );
            }

            branches
                .get(branch)!
                .push(item);
        });

        const branchArray = [
            ...branches.entries(),
        ];

        const centerIndex =
            Math.floor(
                branchArray.length / 2
            );

        const horizontalSpacing =
            300;

        const verticalSpacing =
            180;

        branchArray.forEach(
            (
                [_, records],
                branchIndex
            ) => {
                // SORT
                records.sort(
                    (a, b) =>
                        new Date(
                            a.created_at
                        ).getTime() -
                        new Date(
                            b.created_at
                        ).getTime()
                );

                // TRACK LAST NODE OF EACH STAGE
                const stageMap =
                    new Map<
                        string,
                        string[]
                    >();

                records.forEach(
                    (
                        record,
                        index
                    ) => {
                        const id = `${record.stage}-${record.doc_id}`;

                        const stageIndex =
                            stageLevelMap[
                            record.stage
                            ] ?? 0;

                        // POSITION
                        const sameStageCount =
                            stageMap.get(
                                record.stage
                            )?.length ?? 0;

                        tempNodes.push({
                            id,
                            type: "trace",
                            draggable: true,
                            position: {
                                x:
                                    stageIndex *
                                    horizontalSpacing +
                                    300,

                                y:
                                    320 +
                                    (branchIndex -
                                        centerIndex) *
                                    verticalSpacing +
                                    sameStageCount *
                                    90,
                            },
                            data: {
                                ...record,
                                onClick:
                                    () => {
                                        setcardinfo(
                                            {
                                                title:
                                                    record.stage,
                                                ref:
                                                    record.ref,
                                                id:
                                                    record.doc_id,
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
                        let parentId =
                            rootId;

                        const parentStages =
                            stageParentMap[
                            record.stage
                            ] ?? [];

                        for (const stage of parentStages) {
                            const possibleParents =
                                stageMap.get(stage);

                            if (
                                possibleParents?.length
                            ) {
                                parentId =
                                    possibleParents[
                                    possibleParents.length -
                                    1
                                    ];

                                break;
                            }
                        }

                        tempEdges.push({
                            id: `${parentId}-${id}`,
                            source:
                                parentId,
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

                        if (
                            !stageMap.has(
                                record.stage
                            )
                        ) {
                            stageMap.set(
                                record.stage,
                                []
                            );
                        }

                        stageMap
                            .get(
                                record.stage
                            )!
                            .push(id);
                    }
                );
            }
        );
        const cleanNodes =
            preventOverlap(
                tempNodes
            );

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
                        {/* <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes
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
                        > */}
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
                            {/* <div className="absolute top-4 right-4 z-50">
                                <Button
                                    onClick={autoArrangeCards}
                                    className="shadow-md"
                                    size="sm"
                                >
                                    Auto Arrange
                                </Button>
                            </div> */}
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
                        onClick={() => { }}
                        className="bg-red-400 text-white mx-4 hover:bg-red-400/70" size={"xs"}>
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
        </div>
    );
}
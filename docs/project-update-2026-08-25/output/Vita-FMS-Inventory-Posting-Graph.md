# Vita FMS Inventory Posting Architecture

```mermaid
flowchart LR
    subgraph CONFIG["SETTINGS AND MASTER DATA"]
        direction TB
        DOCSET["DOC Placement Settings"]
        FCSET["Flock Card Settings"]
        DRSET["Harvest & Delivery Settings"]
        CUSET["Clean-up Settings"]
        ITEM["Item Master"]
        GROUP["Item Group / Subgroup"]
        UOM["UoM / Conversion"]
        WHSE["Warehouse"]
        BATCH["Batch Manager"]
    end

    subgraph MODULES["POSTING-CAPABLE FMS MODULES"]
        direction TB

        subgraph INV["INVENTORY"]
            GR["Item Stock In / Goods Receipt"]
            GI["Item Stock Out / Goods Issue"]
            IT["Inventory Transfer"]
        end

        subgraph BROILER["BROILER"]
            direction LR
            DOC["DOC Receiving / DOC Placement"]
            FC["Growing & Farm Condition / Flock Card"]
            DR["Harvest & Delivery"]
            CU["Clean-up"]
            DOC ~~~ FC ~~~ DR ~~~ CU
        end

        subgraph HATCHERY["HATCHERY"]
            HR["Hatchery Receiving"]
            HPROCESS["Classification → Storage → Pre-Warming → Setter → Transfer → Hatcher → Pullout → DOC Classification"]
            HDD["DOC Dispatch"]
            HDISP["Disposal"]
        end

        subgraph BREEDER["BREEDER"]
            BP["Placement"]
            BPROD["Population / Laying / Health Records"]
            BD["Dispatch"]
            BT["Transfer"]
            BCU["Clean-up"]
        end
    end

    LEDGER[("DB: inventory_postings")]

    subgraph OUTPUTS["LEDGER CONSUMERS"]
        AUDIT["Inventory Audit"]
        REPORT["Warehouse Report"]
        TRACE["Trace & Validate"]
        RECON["Batch On-hand and Reconciliation"]
    end

    DOCSET -. "configures" .-> DOC
    FCSET -. "configures" .-> FC
    DRSET -. "configures" .-> DR
    CUSET -. "configures" .-> CU

    ITEM -. "item identity" .-> GR
    GROUP -. "group / subgroup" .-> GR
    UOM -. "quantity rules" .-> GR
    WHSE -. "source / destination" .-> GR
    BATCH -. "batch availability" .-> GR
    ITEM -.-> GI
    GROUP -.-> FC
    UOM -.-> GI
    WHSE -.-> IT
    BATCH -.-> FC
    BATCH -.-> DR
    BATCH -.-> CU

    GR -->|"IN"| LEDGER
    GI -->|"OUT"| LEDGER
    IT -->|"OUT — origin warehouse"| LEDGER
    IT -->|"IN — destination warehouse"| LEDGER

    DOC -->|"IN — posted DOC quantity"| LEDGER
    FC -->|"OUT — feed / mortality / thinning usage"| LEDGER
    DR -->|"OUT — delivered flock batches"| LEDGER
    CU -->|"OUT — clean-up quantities"| LEDGER

    CU ~~~ HR
    HR -. "starts Hatchery process" .-> HPROCESS
    HPROCESS -. "produces dispatch or disposal outcome" .-> HDD
    HPROCESS -.-> HDISP
    HR -->|"IN — received source inventory"| LEDGER
    HDD -->|"OUT — dispatched DOC"| LEDGER
    HDISP -->|"OUT — disposed quantity"| LEDGER

    BP -. "starts Breeder lifecycle" .-> BPROD
    BPROD -. "supplies flock state" .-> BD
    BPROD -.-> BT
    BPROD -.-> BCU
    BP -->|"IN — placed flock quantity"| LEDGER
    BD -->|"OUT — dispatched flock quantity"| LEDGER
    BT -->|"OUT — origin placement"| LEDGER
    BT -->|"IN — destination placement"| LEDGER
    BCU -->|"OUT — final clean-up quantity"| LEDGER

    LEDGER --> AUDIT
    LEDGER --> REPORT
    LEDGER --> TRACE
    LEDGER --> RECON

    classDef db fill:#0B5B3C,color:#FFFFFF,stroke:#063B2B,stroke-width:4px;
    classDef config fill:#F6F2E7,color:#18332A,stroke:#D6A629,stroke-width:2px;
    classDef module fill:#E8F0E9,color:#063B2B,stroke:#0B5B3C,stroke-width:2px;
    classDef output fill:#FFFFFF,color:#18332A,stroke:#66736D,stroke-width:2px;
    class LEDGER db;
    class DOCSET,FCSET,DRSET,CUSET,ITEM,GROUP,UOM,WHSE,BATCH config;
    class GR,GI,IT,DOC,FC,DR,CU,HR,HPROCESS,HDD,HDISP,BP,BPROD,BD,BT,BCU module;
    class AUDIT,REPORT,TRACE,RECON output;
```

## Reading the graph

- Solid arrows into `inventory_postings` represent ledger writes.
- `IN` increases stock in the target warehouse or inventory context.
- `OUT` reduces stock from the source warehouse or inventory context.
- Transfer modules create paired `OUT` and `IN` postings.
- Dashed arrows describe settings, master-data, or workflow dependencies and do not represent ledger writes.
- Inventory Audit, Warehouse Report, Trace & Validate, and reconciliation views read from the common ledger.

## Business-rule confirmation needed

The Broiler and general Inventory directions reflect the currently documented posting behavior. The exact posting direction and activation point for Hatchery DOC Dispatch, Hatchery Disposal, Breeder Placement, Breeder Dispatch, Breeder Transfer, and Breeder Clean-up should be confirmed against their authoritative Post mutations before this diagram is treated as a deployment contract.

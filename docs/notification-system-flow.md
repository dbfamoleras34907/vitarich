# Notification System Flow

This diagram explains how an administrator prepares a notification rule and how a successful module action becomes an in-app notification and, when enabled, an email notification.

Detailed design and reliability contract: [Notification System Design](./notification-system-design.md)

```mermaid
flowchart TD
    subgraph SETUP["1. Notification setup"]
        A["Super Admin or authorized Admin"] --> B["Open Notification Setup"]
        B --> C["Select module"]
        C --> D["Select event<br/>Posted, Edited, or Voided"]
        D --> E["Choose source and recipient filters"]
        E --> E0["Source FMS Type<br/>Where the event occurs"]
        E --> E1["Recipient FMS Type<br/>Who should receive it"]
        E --> E2["User Type<br/>Super Admin, Admin, User"]
        E --> E3["User Group<br/>Example: Farm Managers"]
        E0 --> F["Save and activate rule"]
        E1 --> F
        E2 --> F
        E3 --> F
    end

    subgraph MODULE["2. Module action"]
        G["User selects Post, Edit, or Void"] --> H["Validate business rules and authorization"]
        H --> I{"Business mutation committed?"}
        I -- "No" --> J["Stop<br/>No notification event"]
        I -- "Yes" --> K["Create notification outbox event<br/>moduleKey, eventKey, dedupeKey"]
    end

    subgraph DELIVERY["3. Rule matching and delivery"]
        K --> L["Central notification dispatcher"]
        L --> M{"Active rule for this<br/>module and event?"}
        M -- "No" --> N["Safe no-op<br/>Business action remains successful"]
        M -- "Yes" --> O["Load active users"]
        O --> P{"Matches selected audience?<br/>Recipient FMS AND routed target farm<br/>AND User Type AND User Group"}
        P -- "No" --> Q["Skip user"]
        P -- "Yes" --> R{"Has current module<br/>View permission?"}
        R -- "No" --> Q
        R -- "Yes" --> S["Create one inbox delivery<br/>Unique event plus recipient"]
        S --> S1{"Email checked<br/>on winning rule?"}
        S1 -- "Yes" --> S2["Queue branded Vita FMS email<br/>Unique event plus recipient"]
        S1 -- "No" --> T
        S2 --> S3["Secured Node worker sends through<br/>Microsoft Graph OAuth with independent retry"]
        S3 --> T
    end

    subgraph INBOX["4. User notification experience"]
        T["Realtime or polling refresh"]
        T --> U["Bell badge and notification inbox"]
        U --> V["User opens notification"]
        V --> W["Run route authorization again"]
        W --> X{"Still authorized?"}
        X -- "Yes" --> Y["Open source document"]
        X -- "No" --> Z["Access denied"]
    end

    F -. "Rule is evaluated when the event occurs" .-> M
```

## Recipient matching

- Selections within one filter use **OR**. Example: `Broiler OR Breeder`.
- Different filters use **AND**. Example: `Source Hatchery AND Recipient Broiler AND Farm Managers`.
- Farm-targeted events use the catalog routing mode. Regular Admin/User recipients must be actively assigned to the document, origin, or destination farm selected by that mode; Super Admin retains the farm-assignment bypass.
- An empty filter means **Any** for that dimension.
- Only active users with the module's current View permission receive a delivery.
- A notification informs a user; it never grants module or document access.

## Reliability rules

- Failed or rolled-back Post, Edit, and Void operations create no event.
- When no active rule matches, notification processing is a safe no-op and does not change the completed business action.
- The deterministic deduplication key prevents retries from creating the same notification twice.
- Modules publish business events only. Recipient selection and delivery remain centralized.

# Notification System Flow

The notification center is a compact, in-app template system. It has no browser polling, Realtime subscription, notification email queue, or scheduled notification worker.

Detailed design and deployment boundary: [Notification System Design](./notification-system-design.md)

```mermaid
flowchart TD
    subgraph SETUP["1. Template setup"]
        A["Authorized Admin"] --> B["Open Notification Templates"]
        B --> C["Select a ready module and registered event"]
        C --> D["Enter title and message templates"]
        D --> E["Optionally select User Groups"]
        E --> F["Activate template"]
    end

    subgraph MODULE["2. Successful module action"]
        G["User completes Post, Edit, or Void"] --> H{"Business mutation succeeds?"}
        H -- "No" --> I["No event and no notification"]
        H -- "Yes" --> J["Publish one deduplicated event"]
    end

    subgraph DELIVERY["3. Immediate centralized delivery"]
        J --> K["Immediate dispatcher"]
        K --> L{"Active template matches?"}
        L -- "No" --> M["Safe no-op"]
        L -- "Yes" --> N["Resolve active users"]
        N --> O["Apply template User Group, catalog farm routing, and module View permission"]
        O --> P["Insert one inbox row per matched recipient"]
    end

    subgraph INBOX["4. Inbox"]
        P --> Q["User opens app or clicks Refresh"]
        Q --> R["Bell badge and inbox"]
        R --> S["User clicks notification"]
        S --> T["Mark read and open target route"]
        T --> U["Route authorization runs normally"]
    end

    F -. "Template is evaluated only when its event occurs" .-> L
```

## Recipient matching

- The module owns only the business event facts; it does not choose recipients.
- The event catalog owns module permission and farm-routing requirements.
- An empty User Group selection means every active user who passes farm and View-permission checks.
- Selected User Groups narrow that permitted audience.
- Super Admin retains the established farm-assignment bypass.
- A notification informs a user; it never grants module or document access.

## Reliability rules

- Failed or rolled-back business actions create no notification.
- An inactive or unmatched template is a safe no-op.
- Deterministic event and recipient identities prevent duplicate inbox rows.
- Unexpected notification dispatch errors must not turn a successful business action into a failed one.
- Notification rows are created only when a real event is emitted; empty queues are never polled.

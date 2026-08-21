import { NOTIFICATION_EVENT_KEYS, NOTIFICATION_MODULE_KEYS } from "./eventKeys"
import type { NotificationCatalog } from "./types"

export const notificationCatalog: NotificationCatalog = [
  {
    key: NOTIFICATION_MODULE_KEYS.DOC_RECEIVING,
    label: "DOC Placement",
    description: "DOC receiving and placement documents for Broiler farms.",
    fmsTypes: ["Broiler"],
    defaultRecipientFmsTypes: ["Broiler"],
    permissionGroup: "Menus",
    permissionTitle: "DOC Placement/view",
    baseUrl: "/inv/doc-receiving",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.DOC_RECEIVING.POSTED,
        label: "Document Posted",
        description: "Triggered only after a DOC Placement document reaches Posted status.",
        action: "posted",
        farmRouting: "document",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.HATCHERY_DOC_DISPATCH,
    label: "Hatchery DOC Dispatch",
    description: "Posted Hatchery DOC dispatches sent to a Broiler destination farm.",
    fmsTypes: ["Hatchery"],
    defaultRecipientFmsTypes: ["Broiler"],
    permissionGroup: "Menus",
    permissionTitle: "DOC Placement/view",
    baseUrl: "/inv/doc-receiving/new",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.HATCHERY_DOC_DISPATCH.POSTED,
        label: "Dispatch Posted",
        description: "Triggered only after a Hatchery DOC Dispatch successfully reaches Posted status.",
        action: "posted",
        farmRouting: "destination",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.ITEM_GROUP,
    label: "Item Group",
    description: "Shared Inventory Item Group master data.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Menus",
    permissionTitle: "Item Group/view",
    baseUrl: "/a_dean/itemgroups",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.ITEM_GROUP.EDITED,
        label: "Item Group Edited",
        description: "Triggered after an existing Item Group or Sub Item Group is edited.",
        action: "edited",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.ITEM_GROUP.VOIDED,
        label: "Item Group Voided",
        description: "Triggered once when an Item Group or Sub Item Group becomes void.",
        action: "voided",
        farmRouting: "none",
      },
    ],
  },
]

export function getNotificationModule(moduleKey: string) {
  return notificationCatalog.find(module => module.key === moduleKey)
}

export function getNotificationEvent(moduleKey: string, eventKey: string) {
  return getNotificationModule(moduleKey)?.events.find(event => event.key === eventKey)
}

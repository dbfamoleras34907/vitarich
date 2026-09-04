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
        key: NOTIFICATION_EVENT_KEYS.ITEM_GROUP.POSTED,
        label: "Item Group Posted",
        description: "Triggered after an Item Group or Sub Item Group is created.",
        action: "posted",
        farmRouting: "none",
      },
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
  {
    key: NOTIFICATION_MODULE_KEYS.ITEM_MASTER,
    label: "Item Master",
    description: "Shared Inventory Item master data.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Menus",
    permissionTitle: "Item Master Data/view",
    baseUrl: "/a_dean/items",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.ITEM_MASTER.POSTED,
        label: "Item Created",
        description: "Triggered after a new Item Master record is created.",
        action: "posted",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.ITEM_MASTER.EDITED,
        label: "Item Edited",
        description: "Triggered after an existing Item Master record is edited.",
        action: "edited",
        farmRouting: "none",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.VACCINATION_MEDS,
    label: "Vaccination and Meds",
    description: "Farm medication usage and its inventory issue lifecycle.",
    fmsTypes: ["Broiler", "Breeder"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder"],
    permissionGroup: "Animal Health",
    permissionTitle: "Vaccination and Meds/view",
    baseUrl: "/vnm",
    events: [
      { key: NOTIFICATION_EVENT_KEYS.VACCINATION_MEDS.POSTED, label: "Document Posted", description: "Triggered after inventory is successfully issued for a Vaccination and Meds document.", action: "posted", farmRouting: "document" },
      { key: NOTIFICATION_EVENT_KEYS.VACCINATION_MEDS.EDITED, label: "Draft Edited", description: "Triggered after an existing Vaccination and Meds draft is saved.", action: "edited", farmRouting: "document" },
      { key: NOTIFICATION_EVENT_KEYS.VACCINATION_MEDS.VOIDED, label: "Document Voided", description: "Triggered once after a posted Vaccination and Meds document is voided and inventory is restored.", action: "voided", farmRouting: "document" },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.WORKSPACE_PROJECT,
    label: "Workspace Project",
    description: "Cross-FMS workspace projects and their lifecycle.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Projects",
    permissionTitle: "Projects/view",
    baseUrl: "/wks/projects",
    events: [
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_PROJECT.POSTED, label: "Project Posted", description: "Triggered after a project is created.", action: "posted", farmRouting: "none" },
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_PROJECT.EDITED, label: "Project Edited", description: "Triggered after an existing project is edited.", action: "edited", farmRouting: "none" },
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_PROJECT.VOIDED, label: "Project Voided", description: "Triggered once when a project becomes void.", action: "voided", farmRouting: "none" },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.WORKSPACE_TASK,
    label: "Workspace Task",
    description: "Cross-FMS project tasks and assignments.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Projects",
    permissionTitle: "Task/view",
    baseUrl: "/wks/tasks",
    events: [
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TASK.POSTED, label: "Task Posted", description: "Triggered after a task is created.", action: "posted", farmRouting: "none" },
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TASK.EDITED, label: "Task Edited", description: "Triggered after an existing task is edited.", action: "edited", farmRouting: "none" },
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TASK.VOIDED, label: "Task Voided", description: "Triggered once when a task becomes void.", action: "voided", farmRouting: "none" },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.WORKSPACE_TIMESHEET,
    label: "Workspace Timesheet",
    description: "Cross-FMS workspace timesheets submitted against projects and tasks.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Projects",
    permissionTitle: "Timesheet/view",
    baseUrl: "/wks/timelines",
    events: [
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TIMESHEET.POSTED, label: "Timesheet Submitted", description: "Triggered when a timesheet reaches Submitted status.", action: "posted", farmRouting: "none" },
      { key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TIMESHEET.EDITED, label: "Timesheet Edited", description: "Triggered after an existing timesheet is edited without a submission transition.", action: "edited", farmRouting: "none" },
    ],
  },
]

export function getNotificationModule(moduleKey: string) {
  return notificationCatalog.find(module => module.key === moduleKey)
}

export function getNotificationEvent(moduleKey: string, eventKey: string) {
  return getNotificationModule(moduleKey)?.events.find(event => event.key === eventKey)
}

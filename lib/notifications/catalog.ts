import { NOTIFICATION_EVENT_KEYS, NOTIFICATION_MODULE_KEYS } from "./eventKeys";
import type { NotificationCatalog } from "./types";

export const notificationCatalog: NotificationCatalog = [
  {
    key: NOTIFICATION_MODULE_KEYS.BREEDER_DISPATCH,
    ruleActivationReady: false,
    label: "Breeder Dispatch",
    description: "Persisted receiving-flow actions with canonical farm routing.",
    fmsTypes: ["Breeder"], permissionGroup: "Breeder Masters", permissionTitle: "Breeder Dispatch/view", baseUrl: "/jmb/breederdispatch",
    events: [
      { key: NOTIFICATION_EVENT_KEYS.BREEDER_DISPATCH.POSTED, label: "Posted", description: "Successful persisted posted action.", action: "posted", farmRouting: "document" },
      { key: NOTIFICATION_EVENT_KEYS.BREEDER_DISPATCH.EDITED, label: "Edited", description: "Successful persisted edited action.", action: "edited", farmRouting: "document" },
      { key: NOTIFICATION_EVENT_KEYS.BREEDER_DISPATCH.VOIDED, label: "Voided", description: "Successful persisted voided action.", action: "voided", farmRouting: "document" },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.HATCHERY_RECEIVING,
    ruleActivationReady: false,
    label: "Hatchery Receiving",
    description: "Persisted receiving-flow actions with canonical farm routing.",
    fmsTypes: ["Hatchery"], permissionGroup: "Hatchery Masters", permissionTitle: "Receiving/view", baseUrl: "/a_dean/receiving",
    events: [
      { key: NOTIFICATION_EVENT_KEYS.HATCHERY_RECEIVING.POSTED, label: "Posted", description: "Successful persisted posted action.", action: "posted", farmRouting: "document" },
      { key: NOTIFICATION_EVENT_KEYS.HATCHERY_RECEIVING.EDITED, label: "Edited", description: "Successful persisted edited action.", action: "edited", farmRouting: "document" },
      { key: NOTIFICATION_EVENT_KEYS.HATCHERY_RECEIVING.VOIDED, label: "Voided", description: "Successful persisted voided action.", action: "voided", farmRouting: "document" },
    ],
  },

  {
    key: NOTIFICATION_MODULE_KEYS.BR_CLEANUP,
    ruleActivationReady: false, // Enable only after target SQL deployment and verification.
    label: "Clean up",
    description: "Successful Clean up posts and draft edits.",
    fmsTypes: ["Broiler"],
    permissionGroup: "Menus",
    permissionTitle: "Clean up/view",
    baseUrl: "/brd/cu",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.BR_CLEANUP.POSTED,
        label: "Clean Up Posted",
        description: "Successful inventory post.",
        action: "posted",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.BR_CLEANUP.EDITED,
        label: "Clean Up Edited",
        description: "Persisted edit of an existing draft.",
        action: "edited",
        farmRouting: "document",
      },
    ],
  },
  // 
  {
    key: NOTIFICATION_MODULE_KEYS.BR_DELIVERY,
    ruleActivationReady: false, // Enable only after target SQL deployment and verification.
    label: "Harvest & Delivery",
    description: "Successful Harvest & Delivery posts and draft edits.",
    fmsTypes: ["Broiler"],
    permissionGroup: "Menus",
    permissionTitle: "Harvest & Delivery/view",
    baseUrl: "/brd/dr",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.BR_DELIVERY.POSTED,
        label: "Harvest Posted",
        description: "Successful inventory post.",
        action: "posted",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.BR_DELIVERY.EDITED,
        label: "Harvest Edited",
        description: "Persisted edit of an existing draft.",
        action: "edited",
        farmRouting: "document",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.USER_REGISTRATION,
    label: "User Registration",
    description:
      "Account signup, activation, rejection and first profile completion.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Modules",
    permissionTitle: "User Management/view",
    baseUrl: "/admin/user-activation",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.USER_REGISTRATION.POSTED,
        label: "Registration Submitted",
        description:
          "Emitted after the Auth account and pending registration are saved together.",
        action: "posted",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.USER_REGISTRATION.EDITED,
        label: "Registration Updated",
        description:
          "Account activation or first successful personal information completion.",
        action: "edited",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.USER_REGISTRATION.VOIDED,
        label: "Registration Rejected",
        description: "Successful transition from pending to rejected.",
        action: "voided",
        farmRouting: "none",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.BRD_FC,
    // Enable only after deploying and verifying the farm/transaction SQL.
    ruleActivationReady: false,
    label: "Growing & Farm Condition",
    description: "Successful transactional Growing saves.",
    fmsTypes: ["Broiler"],
    permissionGroup: "Menus",
    permissionTitle: "Growing & Farm Condition/view",
    baseUrl: "/brd/fc",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.BRD_FC.POSTED,
        label: "Growing Saved",
        description: "First successful save of a Growing record.",
        action: "posted",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.BRD_FC.EDITED,
        label: "Growing Edited",
        description: "Successful save of an existing Growing record.",
        action: "edited",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.BRD_FC.VOIDED,
        label: "Growing Reversed",
        description:
          "Successful full Growing reversal; cycle and DOC placement retained.",
        action: "voided",
        farmRouting: "document",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.DOC_RECEIVING,
    ruleActivationReady: false, // Enable after receiving-flow SQL deployment and verification.
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
        description:
          "Triggered only after a DOC Placement document reaches Posted status.",
        action: "posted",
        farmRouting: "document",
      },
      { key: NOTIFICATION_EVENT_KEYS.DOC_RECEIVING.EDITED, label: "Edited", description: "Successful persisted edited action.", action: "edited", farmRouting: "document" },
      { key: NOTIFICATION_EVENT_KEYS.DOC_RECEIVING.VOIDED, label: "Voided", description: "Successful persisted voided action.", action: "voided", farmRouting: "document" },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.HATCHERY_DOC_DISPATCH,
    ruleActivationReady: false, // Enable after receiving-flow SQL deployment and verification.
    label: "Hatchery DOC Dispatch",
    description:
      "Posted Hatchery DOC dispatches sent to a Broiler destination farm.",
    fmsTypes: ["Hatchery"],
    defaultRecipientFmsTypes: ["Broiler"],
    permissionGroup: "Menus",
    permissionTitle: "DOC Placement/view",
    baseUrl: "/inv/doc-receiving/new",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.HATCHERY_DOC_DISPATCH.POSTED,
        label: "Dispatch Posted",
        description:
          "Triggered only after a Hatchery DOC Dispatch successfully reaches Posted status.",
        action: "posted",
        farmRouting: "destination",
      },
      { key: NOTIFICATION_EVENT_KEYS.HATCHERY_DOC_DISPATCH.EDITED, label: "Edited", description: "Successful persisted edited action.", action: "edited", farmRouting: "destination" },
      { key: NOTIFICATION_EVENT_KEYS.HATCHERY_DOC_DISPATCH.VOIDED, label: "Voided", description: "Successful persisted voided action.", action: "voided", farmRouting: "destination" },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.FARM,
    label: "Farm Management",
    description:
      "Farm master records created and maintained through the Farm Setup Wizard.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Modules",
    permissionTitle: "Farm Management",
    baseUrl: "/a_dean/farm",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.FARM.POSTED,
        label: "Farm Posted",
        description:
          "Triggered after a farm is created or its required approval is completed.",
        action: "posted",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.FARM.EDITED,
        label: "Farm Edited",
        description: "Triggered once after an existing farm setup is saved.",
        action: "edited",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.FARM.VOIDED,
        label: "Farm Voided",
        description: "Triggered once when an active farm becomes void.",
        action: "voided",
        farmRouting: "document",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.UOM_GROUP,
    label: "UoM Conversions",
    description: "Shared UoM conversion groups and their default units.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Menus",
    permissionTitle: "UoM Conversions/view",
    baseUrl: "/a_dean/uom-conversions",
    events: [
      { key: NOTIFICATION_EVENT_KEYS.UOM_GROUP.POSTED, label: "UoM Group Created", description: "A conversion group was saved.", action: "posted", farmRouting: "none" },
      { key: NOTIFICATION_EVENT_KEYS.UOM_GROUP.EDITED, label: "UoM Group Edited", description: "An existing conversion group was saved.", action: "edited", farmRouting: "none" },
      { key: NOTIFICATION_EVENT_KEYS.UOM_GROUP.VOIDED, label: "UoM Group Voided", description: "An active conversion group became void.", action: "voided", farmRouting: "none" },
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
        description:
          "Triggered after an Item Group or Sub Item Group is created.",
        action: "posted",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.ITEM_GROUP.EDITED,
        label: "Item Group Edited",
        description:
          "Triggered after an existing Item Group or Sub Item Group is edited.",
        action: "edited",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.ITEM_GROUP.VOIDED,
        label: "Item Group Voided",
        description:
          "Triggered once when an Item Group or Sub Item Group becomes void.",
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
        description:
          "Triggered after an existing Item Master record is edited.",
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
      {
        key: NOTIFICATION_EVENT_KEYS.VACCINATION_MEDS.POSTED,
        label: "Document Posted",
        description:
          "Triggered after inventory is successfully issued for a Vaccination and Meds document.",
        action: "posted",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.VACCINATION_MEDS.EDITED,
        label: "Draft Edited",
        description:
          "Triggered after an existing Vaccination and Meds draft is saved.",
        action: "edited",
        farmRouting: "document",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.VACCINATION_MEDS.VOIDED,
        label: "Document Voided",
        description:
          "Triggered once after a posted Vaccination and Meds document is voided and inventory is restored.",
        action: "voided",
        farmRouting: "document",
      },
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
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_PROJECT.POSTED,
        label: "Project Posted",
        description: "Triggered after a project is created.",
        action: "posted",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_PROJECT.EDITED,
        label: "Project Edited",
        description: "Triggered after an existing project is edited.",
        action: "edited",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_PROJECT.VOIDED,
        label: "Project Voided",
        description: "Triggered once when a project becomes void.",
        action: "voided",
        farmRouting: "none",
      },
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
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TASK.POSTED,
        label: "Task Posted",
        description: "Triggered after a task is created.",
        action: "posted",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TASK.EDITED,
        label: "Task Edited",
        description: "Triggered after an existing task is edited.",
        action: "edited",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TASK.VOIDED,
        label: "Task Voided",
        description: "Triggered once when a task becomes void.",
        action: "voided",
        farmRouting: "none",
      },
    ],
  },
  {
    key: NOTIFICATION_MODULE_KEYS.WORKSPACE_TIMESHEET,
    label: "Workspace Timesheet",
    description:
      "Cross-FMS workspace timesheets submitted against projects and tasks.",
    fmsTypes: ["Broiler", "Breeder", "Hatchery"],
    defaultRecipientFmsTypes: ["Broiler", "Breeder", "Hatchery"],
    permissionGroup: "Projects",
    permissionTitle: "Timesheet/view",
    baseUrl: "/wks/timelines",
    events: [
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TIMESHEET.POSTED,
        label: "Timesheet Submitted",
        description: "Triggered when a timesheet reaches Submitted status.",
        action: "posted",
        farmRouting: "none",
      },
      {
        key: NOTIFICATION_EVENT_KEYS.WORKSPACE_TIMESHEET.EDITED,
        label: "Timesheet Edited",
        description:
          "Triggered after an existing timesheet is edited without a submission transition.",
        action: "edited",
        farmRouting: "none",
      },
    ],
  },
];

export function getNotificationModule(moduleKey: string) {
  return notificationCatalog.find((module) => module.key === moduleKey);
}

export function getNotificationEvent(moduleKey: string, eventKey: string) {
  return getNotificationModule(moduleKey)?.events.find(
    (event) => event.key === eventKey,
  );
}

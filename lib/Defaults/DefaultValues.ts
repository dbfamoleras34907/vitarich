import {
  Boxes,
  Calendar,
  CalendarClock,
  Contact2,
  DockIcon,
  DollarSign,
  BirdIcon,
  EggIcon,
  FileSliders,
  FolderTree,
  Home,
  PenBoxIcon,
  ShoppingCartIcon,
  Wrench,
} from "lucide-react";
import { CodeNameBase } from "./DefaultTypes";
import EggHatchTable from "@/app/jmb/egghatcherv2/egghatch-table";
import { NavFolder } from "../types";



// export const NavFolders = [
//   {
//     id: 0,
//     title: "Home",
//     url: "/home",
//     icon: Home,
//     items: [
//       {
//         group: "Reports",
//         children: [{ type: "Report", title: "Dashboard", url: "/home" }],
//       },
//     ],
//   },
//   {
//     id: 2,
//     title: "Breeder",
//     url: "/jmb/breeder",
//     icon: BirdIcon,
//     items: [
//       {
//         group: "Breeder Masters",
//         children: [
//           { type: "Module", title: "Placement", url: "/jmb/placement" },

//           {
//             type: "Module",
//             title: "Growing Period",
//             // url: "/jmb/hatcheryclassi", /home
//             url: "/home",
//           },
//           {
//             type: "Module",
//             title: "Laying Production",
//             url: "/jmb/egglaying",
//           },
//           {
//             type: "Module",
//             title: "Breeder Dispatch",
//             url: "/home",
//           },
//           {
//             type: "Module",
//             title: "Stock In/Out",
//             url: "/home",
//           },
//           {
//             type: "Module",
//             title: "Vaccination",
//             url: "/home",
//           },
//           {
//             type: "Module",
//             title: "Medication",
//             url: "/home",
//           },
//           {
//             type: "Module",
//             title: "Reports",
//             url: "/home",
//           },
//         ],
//       },
//       {
//         group: "Reports",
//         children: [
//           { type: "Report", title: "Room Monitoring", url: "#" },
//           { type: "Report", title: "Machine Monitoring", url: "#" },
//         ],
//       },
//     ],
//   },
//   {
//     id: 1,
//     title: "Hatchery",
//     url: "/a_dean/hatchery",
//     icon: EggIcon,
//     items: [
//       {
//         group: "Hatchery Masters",
//         children: [
//           { type: "Module", title: "Receiving", url: "/a_dean/receiving", inventoriable: true },

//           {
//             type: "Module",
//             title: "Egg Classification",
//             url: "/jmb/hatcheryclassi",
//           },
//           { type: "Module", title: "Egg Storage", url: "/jmb/eggstorage", inventoriable: true },
//           {
//             type: "Module",
//             title: "Egg Pre-Warming Process",
//             url: "/jmb/prewarmingv2",
//           },
//           { type: "Module", title: "Egg Setter", url: "/jmb/eggsetter" },
//           {
//             type: "Module",
//             title: "Egg Transfer Process",
//             url: "/jmb/eggtransferv2",
//           },
//           {
//             type: "Module",
//             title: "Egg Hatcher Process",
//             url: "/jmb/egghatcherv2",
//           },
//           {
//             type: "Module",
//             title: "Chick Pullout Process",
//             url: "/jmb/chickpulloutv2",
//           },
//           {
//             type: "Module",
//             title: "DOC Classification",
//             url: "/jmb/docclassification", inventoriable: true
//           },
//           { type: "Module", title: "DOC Dispatch", url: "/jmb/docdispatchv2", inventoriable: true },
//           { type: "Module", title: "Disposal", url: "/a_dean/disposal", inventoriable: true },
//         ],
//       },
//       {
//         group: "Reports",
//         children: [
//           { type: "Report", title: "Room Monitoring", url: "#" },
//           { type: "Report", title: "Machine Monitoring", url: "#" },
//         ],
//       },
//     ],
//   },

//   {
//     id: 3,
//     title: "Inventory Management",
//     url: "/a_dean/inventory",
//     icon: Boxes, // Example icon name
//     items: [
//       {
//         group: "Item Management",
//         children: [
//           { type: "Module", title: "Item Master Data", url: "/a_dean/items" },
//           {
//             type: "Module",
//             title: "Warehouse Master Data",
//             url: "/a_dean/warehouse",
//           },
//           { type: "Module", title: "Bin  Master Data", url: "#" },
//           // { type: "Module", title: "Alternative Items", url: "#" },
//         ],
//       },
//       {
//         group: "Inventory Transactions",
//         children: [
//           // { type: "Module", title: "Goods Receipt", url: "#" },
//           // { type: "Module", title: "Goods Issue", url: "#" },
//           { type: "Module", title: "Inventory", url: "/a_dean/inventory/inv" },
//           { type: "Module", title: "Inventory Map", url: "/inv" },
//           // { type: "Module", title: "Inventoryu", url: "/a_dean/inventory/inv" },
//           // { type: "Module", title: "Inventory Transfer", url: "#" },
//           // { type: "Module", title: "Inventory Transfer Request", url: "#" },
//         ],
//       },
//       // {
//       //   group: "Price Lists",
//       //   children: [
//       //     { type: "Module", title: "Price Lists", url: "/a_dean/price-lists" },
//       //     { type: "Module", title: "Period and Volume Discounts", url: "/a_dean/discounts" },
//       //     { type: "Module", title: "Special Prices", url: "/a_dean/special-prices" },
//       //   ],
//       // },
//       {
//         group: "Inventory Reports",
//         children: [
//           {
//             type: "Report",
//             title: "Inventory Posting Report",
//             url: "/a_dean/invaudit",
//           },
//           { type: "Report", title: "Inventory Status", url: "#" },
//           { type: "Report", title: "Warehouse Content List", url: "#" },
//         ],
//       },
//     ],
//   },
//   {
//     id: 4,
//     title: "Workspace",
//     url: "#",
//     icon: FolderTree, // Example icon name
//     items: [
//       {
//         group: "Projects",
//         children: [
//           { type: "Module", title: "Dashboard", url: "/wks/dashboard" },
//           { type: "Module", title: "Projects", url: "/wks/projects" },
//           { type: "Module", title: "Task", url: "/wks/tasks" },
//           // { type: "Module", title: "Project Type", url: "" },
//           { type: "Module", title: "Timesheet", url: "/wks/timelines" },

//         ],
//       },
//     ],
//   },
//   // {
//   //   id: 5,
//   //   title: "Timesheet",
//   //   url: "#",
//   //   icon: CalendarClock, // Example icon name
//   //   items: [
//   //     {
//   //       group: "Timesheet",
//   //       children: [
//   //         // { type: "Module", title: "Activity Type", url: "/wks/t/report" },
//   //         // { type: "Module", title: "Reports", url: "/wks/t/r" },
//   //       ],
//   //     },
//   //   ],
//   // },
//   {
//     id: 99,
//     title: "Settings",
//     url: "/admin",
//     icon: FileSliders,
//     items: [
//       {
//         group: "Modules",
//         children: [
//           { type: "Module", title: "User Management", url: "/admin/user" },
//           { type: "Module", title: "Approval", url: "/admin/approval" },
//           { type: "Module", title: "Farm Settings", url: "/a_dean/farm" },
//           {
//             type: "Module",
//             title: "Broiler Settings",
//             url: "/jmb/boilermasterdata",
//           },
//           { type: "Module", title: "General Settings", url: "#" },
//           { type: "Module", title: "Document Settings", url: "#" },
//           // { type: "Module", title: "User Details / Roles & Permissions", url: "/admin/user/new/" },
//         ],
//       },
//     ],
//   },
// ];


// export const NavFolders = [
//   {
//     id: 0,
//     title: "Home",
//     url: "/home",
//     icon: Home,
//     items: [
//       {
//         group: "Reports",
//         children: [
//           { id: 1, type: "Report", title: "Dashboard", url: "/home" }
//         ],
//       },
//     ],
//   },
//   {
//     id: 2,
//     title: "Breeder",
//     url: "/jmb/breeder",
//     icon: BirdIcon,
//     items: [
//       {
//         group: "Breeder Masters",
//         children: [
//           { id: 2, type: "Module", title: "Placement", url: "/jmb/placement" },
//           { id: 3, type: "Module", title: "Growing Period", url: "/home" },
//           { id: 4, type: "Module", title: "Laying Production", url: "/jmb/egglaying" },
//           { id: 5, type: "Module", title: "Breeder Dispatch", url: "/home" },
//           { id: 6, type: "Module", title: "Stock In/Out", url: "/home" },
//           { id: 7, type: "Module", title: "Vaccination", url: "/home" },
//           { id: 8, type: "Module", title: "Medication", url: "/home" },
//           { id: 9, type: "Module", title: "Reports", url: "/home" },
//         ],
//       },
//       {
//         group: "Reports",
//         children: [
//           { id: 10, type: "Report", title: "Room Monitoring", url: "#" },
//           { id: 11, type: "Report", title: "Machine Monitoring", url: "#" },
//         ],
//       },
//     ],
//   },
//   {
//     id: 1,
//     title: "Hatchery",
//     url: "/a_dean/hatchery",
//     icon: EggIcon,
//     items: [
//       {
//         group: "Hatchery Masters",
//         children: [
//           { id: 12, type: "Module", title: "Receiving", url: "/a_dean/receiving", inventoriable: true },
//           { id: 13, type: "Module", title: "Egg Storage", url: "/jmb/eggstorage", inventoriable: true },
//           { id: 14, type: "Module", title: "DOC Classification", url: "/jmb/docclassification", inventoriable: true },
//           { id: 15, type: "Module", title: "DOC Dispatch", url: "/jmb/docdispatchv2", inventoriable: true },
//           { id: 16, type: "Module", title: "Disposal", url: "/a_dean/disposal", inventoriable: true },
//         ],
//       },
//       {
//         group: "Reports",
//         children: [
//           { id: 17, type: "Report", title: "Room Monitoring", url: "#" },
//           { id: 18, type: "Report", title: "Machine Monitoring", url: "#" },
//         ],
//       },
//     ],
//   },
//   {
//     id: 3,
//     title: "Inventory Management",
//     url: "/a_dean/inventory",
//     icon: Boxes,
//     items: [
//       {
//         group: "Item Management",
//         children: [
//           { id: 19, type: "Module", title: "Item Master Data", url: "/a_dean/items" },
//           { id: 20, type: "Module", title: "Warehouse Master Data", url: "/a_dean/warehouse" },
//           { id: 21, type: "Module", title: "Bin  Master Data", url: "#" },
//         ],
//       },
//       {
//         group: "Inventory Transactions",
//         children: [
//           { id: 22, type: "Module", title: "Inventory", url: "/a_dean/inventory/inv" },
//           { id: 23, type: "Module", title: "Inventory Map", url: "/inv" },
//           { id: 37, type: "Module", title: "Goods Reciept", url: "/inv/gr", inventoriable: true },
//           { id: 38, type: "Module", title: "Goods Issue", url: "/inv/gi", inventoriable: true },
//         ],
//       },
//       {
//         group: "Inventory Reports",
//         children: [
//           { id: 24, type: "Report", title: "Inventory Posting Report", url: "/a_dean/invaudit" },
//           { id: 25, type: "Report", title: "Inventory Status", url: "#" },
//           { id: 26, type: "Report", title: "Warehouse Content List", url: "#" },
//         ],
//       },
//     ],
//   },
//   {
//     id: 4,
//     title: "Workspace",
//     url: "#",
//     icon: FolderTree,
//     items: [
//       {
//         group: "Projects",
//         children: [
//           { id: 27, type: "Module", title: "Dashboard", url: "/wks/dashboard" },
//           { id: 28, type: "Module", title: "Projects", url: "/wks/projects" },
//           { id: 29, type: "Module", title: "Task", url: "/wks/tasks" },
//           { id: 30, type: "Module", title: "Timesheet", url: "/wks/timelines" },
//         ],
//       },
//     ],
//   },
//   {
//     id: 99,
//     title: "Settings",
//     url: "/admin",
//     icon: FileSliders,
//     items: [
//       {
//         group: "Modules",
//         children: [
//           { id: 31, type: "Module", title: "User Management", url: "/admin/user" },
//           { id: 32, type: "Module", title: "Approval", url: "/admin/approval" },
//           { id: 33, type: "Module", title: "Farm Settings", url: "/a_dean/farm" },
//           { id: 34, type: "Module", title: "Broiler Settings", url: "/jmb/boilermasterdata" },
//           { id: 35, type: "Module", title: "General Settings", url: "#" },
//           { id: 36, type: "Module", title: "Document Settings", url: "#" },
//         ],
//       },
//     ],
//   },
// ];

export const NavFolders: NavFolder[] = [
  {
    id: 0,
    title: "Home",
    url: "/home",
    icon: Home,
    items: [
      {
        group: "Reports",
        children: [
          {
            id: 1,
            type: "Report",
            title: "Dashboard",
            url: "/home",
            view: false,
            insert: false,
            edit: false,
          },
        ],
      },
    ],
  },

  {
    id: 2,
    title: "Breeder",
    url: "/jmb/breeder",
    icon: BirdIcon,
    items: [
      {
        group: "Breeder Masters",
        children: [
          {
            id: 2,
            type: "Module",
            title: "Placement",
            url: "/jmb/placement",
          },

          {
            id: 3,
            type: "Module",
            title: "Growing Period",
            url: "/home",
          },

          {
            id: 4,
            type: "Module",
            title: "Laying Production",
            url: "/jmb/egglaying",
          },

          {
            id: 5,
            type: "Module",
            title: "Breeder Dispatch",
            url: "/home",
          },

          {
            id: 6,
            type: "Module",
            title: "Stock In/Out",
            url: "/home",
          },

          {
            id: 7,
            type: "Module",
            title: "Vaccination",
            url: "/home",
          },

          {
            id: 8,
            type: "Module",
            title: "Medication",
            url: "/home",
          },

          {
            id: 9,
            type: "Module",
            title: "Reports",
            url: "/home",
          },
        ],
      },

      {
        group: "Reports",
        children: [
          {
            id: 10,
            type: "Report",
            title: "Room Monitoring",
            url: "#",
          },

          {
            id: 11,
            type: "Report",
            title: "Machine Monitoring",
            url: "#",
          },
        ],
      },
    ],
  },

  {
    id: 1,
    title: "Hatchery",
    url: "/a_dean/hatchery",
    icon: EggIcon,
    items: [
      {
        group: "Hatchery Masters",
        children: [
          {
            id: 12,
            type: "Module",
            title: "Receiving",
            url: "/a_dean/receiving",
            inventoriable: true,
            section: "HA",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 13,
            type: "Module",
            title: "Egg Classification",
            url: "/jmb/hatcheryclassi",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 14,
            type: "Module",
            title: "Egg Storage",
            url: "/jmb/eggstorage",
            inventoriable: true,
            section: "HA",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 15,
            type: "Module",
            title: "Egg Pre-Warming Process",
            url: "/jmb/prewarmingv2",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 16,
            type: "Module",
            title: "Egg Setter",
            url: "/jmb/eggsetter",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 17,
            type: "Module",
            title: "Egg Transfer Process",
            url: "/jmb/eggtransferv2",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 18,
            type: "Module",
            title: "Egg Hatcher Process",
            url: "/jmb/egghatcherv2",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 19,
            type: "Module",
            title: "Chick Pullout Process",
            url: "/jmb/chickpulloutv2",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 20,
            type: "Module",
            title: "DOC Classification",
            url: "/jmb/docclassification",
            inventoriable: true,
            section: "HA",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 21,
            type: "Module",
            title: "DOC Dispatch",
            url: "/jmb/docdispatchv2",
            inventoriable: true,
            section: "HA",
            view: true,
            insert: true,
            edit: false,
          },

          {
            id: 22,
            type: "Module",
            title: "Disposal",
            url: "/a_dean/disposal",
            inventoriable: true,
            section: "HA",
            view: true,
            insert: true,
            edit: false,
          },
        ],
      },

      {
        group: "Reports",
        children: [
          {
            id: 23,
            type: "Report",
            title: "Room Monitoring",
            url: "#",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 24,
            type: "Report",
            title: "Machine Monitoring",
            url: "#",
            view: false,
            insert: false,
            edit: false,
          },
        ],
      },
    ],
  },

  {
    id: 3,
    title: "Inventory Management",
    url: "/a_dean/inventory",
    icon: Boxes,
    items: [
      {
        group: "Item Management",
        children: [
          {
            id: 25,
            type: "Module",
            title: "Item Master Data",
            url: "/a_dean/items",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 26,
            type: "Module",
            title: "Warehouse Master Data",
            url: "/a_dean/warehouse",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 50,
            type: "Module",
            title: "Inventory Map",
            url: "/inv",
            view: false,
            insert: false,
            edit: false,
          },
        ],
      },

      {
        group: "Inventory Transactions",
        children: [
          // {
          //   id: 28,
          //   type: "Module",
          //   title: "Inventory",
          //   url: "/a_dean/inventory/inv",
          // },
          {
            id: 51, type: "Module", title: "Goods Reciept", url: "/inv/gr", inventoriable: true, section: "IV", view: false,
            insert: false,
            edit: false,
          },
          {
            id: 52, type: "Module", title: "Goods Issue", url: "/inv/gi", inventoriable: true, section: "IV", view: false,
            insert: false,
            edit: false,
          },
        ],
      },

      {
        group: "Inventory Reports",
        children: [
          {
            id: 30,
            type: "Report",
            title: "Inventory Posting Report",
            url: "/a_dean/invaudit",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 31,
            type: "Report",
            title: "Inventory Status",
            url: "#",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 32,
            type: "Report",
            title: "Warehouse Content List",
            url: "#",
            view: false,
            insert: false,
            edit: false,
          },
        ],
      },
    ],
  },

  {
    id: 4,
    title: "Workspace",
    url: "#",
    icon: FolderTree,
    view: false,
    insert: false,
    edit: false,
    items: [
      {
        group: "Projects",
        children: [
          {
            id: 33,
            type: "Module",
            title: "Dashboard",
            url: "/wks/dashboard",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 34,
            type: "Module",
            title: "Projects",
            url: "/wks/projects",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 35,
            type: "Module",
            title: "Task",
            url: "/wks/tasks",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 36,
            type: "Module",
            title: "Timesheet",
            url: "/wks/timelines",
            view: false,
            insert: false,
            edit: false,
          },
        ],
      },
    ],
  },

  {
    id: 99,
    title: "Settings",
    url: "/admin",
    icon: FileSliders,
    items: [
      {
        group: "Modules",
        children: [
          {
            id: 37,
            type: "Module",
            title: "User Management",
            url: "/admin/user",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 38,
            type: "Module",
            title: "Approval",
            url: "/admin/approval",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 39,
            type: "Module",
            title: "Farm Settings",
            url: "/a_dean/farm",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 40,
            type: "Module",
            title: "Broiler Settings",
            url: "/jmb/boilermasterdata",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 41,
            type: "Module",
            title: "General Settings",
            url: "#",
            view: false,
            insert: false,
            edit: false,
          },

          {
            id: 42,
            type: "Module",
            title: "Document Settings",
            url: "#",
            view: false,
            insert: false,
            edit: false,
          },
        ],
      },
    ],
  },
];
const startYear = 2024;
const endYear = new Date().getFullYear() + 2;
export const ListOfYear: CodeNameBase[] = Array.from(
  { length: endYear - startYear + 1 },
  (_, i) => {
    const year = (startYear + i).toString();
    return { code: year, name: year };
  },
);

export const DefaultGenders = [
  { code: "Male", name: "Male" },
  { code: "Female", name: "Female" },
];

export const today = new Date().toISOString().slice(0, 10);

export type IssueStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "reopened";

export const ISSUE_STATUSES: {
  code: IssueStatus;
  name: string;
  color: string;
}[] = [
    { code: "todo", name: "To Do", color: "gray" },
    { code: "in_progress", name: "In Progress", color: "blue" },
    { code: "in_review", name: "In Review", color: "purple" },
    { code: "blocked", name: "Blocked", color: "red" },
    { code: "done", name: "Done", color: "green" },
    { code: "reopened", name: "Reopened", color: "orange" },
  ];

export type IssuePriority = "high" | "medium" | "low";

export const ISSUE_PRIORITIES: {
  code: IssuePriority;
  name: string;
  color: string;
}[] = [
    // { code: "highest", name: "Highest", color: "red" },
    { code: "high", name: "High", color: "orange" },
    { code: "medium", name: "Medium", color: "yellow" },
    { code: "low", name: "Low", color: "blue" },
    // { code: "lowest", name: "Lowest", color: "gray" },
  ];
// export const ISSUE_PRIORITIES = [
//   { code: "highest", name: "Highest", color: "red" },
//   { code: "high", name: "High", color: "orange" },
//   { code: "medium", name: "Medium", color: "yellow" },
//   { code: "low", name: "Low", color: "blue" },
//   { code: "lowest", name: "Lowest", color: "gray" },
// ]
// type NavFolder = typeof NavFolders[number];

export function getInventoriableModules(navFolders: NavFolder[]) {
  const result: any[] = [];

  navFolders.forEach((folder) => {
    folder.items?.forEach((group) => {
      group.children?.forEach((child) => {
        if ((child as any).inventoriable === true) {
          result.push({
            ...child,
            code: child.id,
            name: child.title,
            parent: folder.title,
            group: group.group,
            section: (child as any)?.section || "",

          });
        }
      });
    });
  });

  return result;
}
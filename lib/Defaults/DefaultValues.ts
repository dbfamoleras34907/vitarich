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
  Drumstick,
} from "lucide-react";
import { CodeNameBase } from "./DefaultTypes";
import EggHatchTable from "@/app/jmb/egghatcherv2/egghatch-table";
import { NavChild, NavFolder } from "../types";

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
//     title: "Inventory",
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
//     title: "Inventory",
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
            title: "Population Record",
            url: "/jmb/growing",
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
            newDocumentUrl: "/a_dean/receiving/manual",
            inventoriable: true,
            section: "HA",
            view: true,
            void: true,
            insert: true,
            edit: false,
            approval: true,
          },

          {
            id: 13,
            type: "Module",
            title: "Egg Classification",
            url: "/jmb/hatcheryclassi",
            view: true,
            void: true,
            insert: true,
            edit: false,
            approval: false,
          },

          {
            id: 14,
            type: "Module",
            title: "Egg Storage",
            url: "/jmb/eggstorage",
            newDocumentUrl: "/jmb/eggstorage/new",
            inventoriable: true,
            section: "HA",
            view: true,
            void: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 15,
            type: "Module",
            title: "Egg Pre-Warming Process",
            url: "/jmb/prewarmingv2",
            newDocumentUrl: "/jmb/prewarmingv2/new2",
            view: true,
            void: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 16,
            type: "Module",
            title: "Egg Setter",
            url: "/jmb/eggsetter",
            newDocumentUrl: "/jmb/eggsetter/new",
            view: true,
            void: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 17,
            type: "Module",
            title: "Egg Transfer Process",
            url: "/jmb/eggtransferv2",
            newDocumentUrl: "/jmb/eggtransferv2/newv2",
            view: true,
            void: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 18,
            type: "Module",
            title: "Egg Hatcher Process",
            url: "/jmb/egghatcherv2",
            newDocumentUrl: "/jmb/egghatcherv2/newv2",
            view: true,
            void: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 19,
            type: "Module",
            title: "Chick Pullout Process",
            url: "/jmb/chickpulloutv2",
            newDocumentUrl: "/jmb/chickpulloutv2/newv2",
            view: true,
            void: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 20,
            type: "Module",
            title: "DOC Classification",
            url: "/jmb/docclassification",
            newDocumentUrl: "/jmb/docclassification/newv2",
            inventoriable: true,
            section: "HA",
            view: true,
            void: true,
            insert: true,
            edit: false,
            approval: false,
          },

          {
            id: 21,
            type: "Module",
            title: "DOC Dispatch",
            url: "/jmb/docdispatchv2",
            newDocumentUrl: "/jmb/docdispatchv2/newv2",
            inventoriable: true,
            section: "HA",
            view: true,
            void: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 22,
            type: "Module",
            title: "Disposal",
            url: "/a_dean/disposal",
            newDocumentUrl: "/a_dean/disposal/new",
            inventoriable: true,
            section: "HA",
            view: true,
            void: true,
            insert: true,
            edit: false,
            approval: false,
          },
        ],
      },

      {
        group: "Reports",
        children: [
          {
            id: 23,
            type: "Report",
            title: "System Adoption Report",
            url: "/report/sysadrep",
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
    title: "Inventory",
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
            insert: true,
            edit: true,
            approval: false,
          },

          // {
          //   id: 51,
          //   type: "Module",
          //   title: "Item Group Master Data",
          //   url: "/a_dean/itemgroups",
          //   view: false,
          //   insert: false,
          //   edit: false,
          // },

          {
            id: 26,
            type: "Module",
            title: "Warehouse Master Data",
            url: "/a_dean/warehouse",
            view: false,
            insert: false,
            edit: false,
            approval: false,
          },

          // {
          //   id: 50,
          //   type: "Module",
          //   title: "Inventory Map",
          //   url: "/inv",
          //   view: false,
          //   insert: false,
          //   edit: false,
          // },  
           {
            id: 50,
            type: "Module",
            title: "Item Group",
            url: "/a_dean/itemgroups",
            view: true,
            insert: true,
            edit: true,
            approval: false,
            void: true,
          },
          {
            id: 53,
            type: "Module",
            title: "UoM Master",
            url: "/a_dean/uom-master",
            // view: true,
            insert: true,
            edit: true,
            approval: false,
            void: true,
          },
          {
            id: 54,
            type: "Module",
            title: "UoM Conversions",
            url: "/a_dean/uom-conversions",
            // view: true,
            insert: true,
            edit: true,
            approval: false,
            void: true,
          },
          {
            id: 55,
            type: "Module",
            title: "Batch Manager",
            url: "/inv/btch",
            // view: true,
            insert: true,
            edit: true,
            approval: false,
            void: false,
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
            id: 51,
            type: "Module",
            title: "Item Stock In",
            url: "/inv/gr",
            inventoriable: true,
            section: "IV",
            view: false,
            insert: false,
            edit: false,
            approval: false,
          },
          {
            id: 52,
            type: "Module",
            title: "Item Stock Out",
            url: "/inv/gi",
            newDocumentUrl: "/inv/gi/new",
            inventoriable: true,
            section: "IV",
            view: true,
            insert: true,
            edit: true,
            approval: false,
          },
          {
            id: 56,
            type: "Module",
            title: "Inventory Transfer",
            url: "/inv/it",
            newDocumentUrl: "/inv/it/new",
            inventoriable: true,
            section: "IV",
            view: true,
            insert: true,
            edit: true,
            approval: false,
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
            id: 58,
            type: "Report",
            title: "Warehouse Report",
            url: "/inv/whse-report",
            view: true,
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

  // {
  //   id: 4,
  //   title: "Workspace",
  //   url: "#",
  //   icon: FolderTree,
  //   view: false,
  //   insert: false,
  //   edit: false,
  //   items: [
  //     {
  //       group: "Projects",
  //       children: [
  //         {
  //           id: 33,
  //           type: "Module",
  //           title: "Dashboard",
  //           url: "/wks/dashboard",
  //           view: false,
  //           insert: false,
  //           edit: false,
  //         },

  //         {
  //           id: 34,
  //           type: "Module",
  //           title: "Projects",
  //           url: "/wks/projects",
  //           view: false,
  //           insert: false,
  //           edit: false,
  //         },

  //         {
  //           id: 35,
  //           type: "Module",
  //           title: "Task",
  //           url: "/wks/tasks",
  //           view: false,
  //           insert: false,
  //           edit: false,
  //         },

  //         {
  //           id: 36,
  //           type: "Module",
  //           title: "Timesheet",
  //           url: "/wks/timelines",
  //           view: false,
  //           insert: false,
  //           edit: false,
  //         },
  //       ],
  //     },
  //   ],
  // },

  {
    id: 6,
    title: "Broiler",
    url: "#",
    icon: Drumstick,
    view: false,
    insert: false,
    edit: false,
    items: [
      {
        group: "Menus",
        children: [
          {
            id: 60,
            type: "Module",
            title: "Dashboard",
            url: "/brd/dashboard",
            view: false,
            insert: false,
            edit: false,
            approval: false,
          },

          {
            id: 57,
            type: "Module",
            title: "DOC Receiving",
            url: "/inv/doc-receiving",
            newDocumentUrl: "/inv/doc-receiving/new",
            inventoriable: true,
            section: "IV",
            view: true,
            insert: true,
            edit: false,
            approval: false,
          },

          {
            id: 61,
            type: "Module",
            title: "Flock Card",
            url: "/brd/fc",
            view: false,
            insert: false,
            edit: false,
            approval: false,
          },

          {
            id: 67,
            type: "Report",
            title: "Flock Card Report",
            url: "/brd/fc/report",
            view: true,
            insert: false,
            edit: false,
          },

          {
            id: 62,
            type: "Module",
            title: "Delivery",
            url: "/brd/dr",
            newDocumentUrl: "/brd/dr/new",
            view: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 63,
            type: "Module",
            title: "Clean up",
            url: "/brd/cu",
            newDocumentUrl: "/brd/cu/new",
            view: true,
            insert: true,
            edit: true,
            approval: false,
          },

        ],
      },
      {
        group: "Settings",
        children: [
          {
            id: 65,
            type: "Module",
            title: "DOC Receiving Settings",
            url: "/a_dean/doc-receiving-settings",
            view: false,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 66,
            type: "Module",
            title: "Flock Card Settings",
            url: "/brd/fc/settings",
            view: false,
            insert: false,
            edit: true,
            approval: false,
          },

          {
            id: 71,
            type: "Module",
            title: "Delivery Settings",
            url: "/brd/dr/settings",
            view: false,
            insert: false,
            edit: true,
            approval: false,
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
            approval: false,
          },

          {
            id: 70,
            type: "Module",
            title: "User Group",
            url: "/admin/user-group",
            view: true,
            insert: true,
            edit: true,
            approval: false,
          },

          {
            id: 69,
            type: "Module",
            title: "User Activation",
            url: "/admin/user-activation",
            view: true,
            insert: false,
            edit: true,
            approval: false,
          },

          {
            id: 38,
            type: "Module",
            title: "Approval",
            url: "/admin/approval",
            view: true,
            insert: false,
            edit: true,
            approval: false,
          },

          {
            id: 68,
            type: "Module",
            title: "Approval Management",
            url: "/admin/approval/management",
            view: true,
            insert: false,
            edit: true,
            approval: false,
          },

          {
            id: 39,
            type: "Module",
            title: "Farm Management",
            url: "/a_dean/farm",
            view: false,
            insert: false,
            edit: false,
            approval: false,
          },

          {
            id: 64,
            type: "Module",
            title: "Farm Setup Wizard",
            url: "/a_dean/farm/setup",
            view: false,
            insert: true,
            edit: false,
            approval: true,
          },

          {
            id: 40,
            type: "Module",
            title: "Broiler Settings",
            url: "/jmb/boilermasterdata",
            view: false,
            insert: false,
            edit: false,
            approval: false,
          },

          {
            id: 41,
            type: "Module",
            title: "General Settings",
            url: "#",
            view: false,
            insert: false,
            edit: false,
            approval: false,
          },

          // {
          //   id: 42,
          //   type: "Module",
          //   title: "Document Settings",
          //   url: "#",
          //   view: false,
          //   insert: false,
          //   edit: false,
          // },

          {
            id: 43,
            type: "Module",
            title: "Permission Template",
            url: "/admin/permissions",
            view: true,
            void: false,
            insert: false,
            edit: false,
            approval: false,
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

type InventoriableModule = NavChild & {
  code: number;
  name: string;
  parent: string;
  group: string;
  section: string;
};

export function getInventoriableModules(navFolders: NavFolder[]) {
  const result: InventoriableModule[] = [];

  navFolders.forEach((folder) => {
    folder.items?.forEach((group) => {
      group.children?.forEach((child) => {
        if (child.inventoriable === true) {
          result.push({
            ...child,
            code: child.id,
            name: child.title,
            parent: folder.title,
            group: group.group,
            section: child.section || "",
          });
        }
      });
    });
  });

  return result;
}

export const regionList: CodeNameBase[] = [
  { code: "NCR", name: "National Capital Region (NCR)" },
  { code: "CAR", name: "Cordillera Administrative Region (CAR)" },
  { code: "01", name: "Ilocos Region" },
  { code: "02", name: "Cagayan Valley" },
  { code: "03", name: "Central Luzon" },
  { code: "04A", name: "CALABARZON" },
  { code: "04B", name: "MIMAROPA" },
  { code: "05", name: "Bicol Region" },
  { code: "06", name: "Western Visayas" },
  { code: "07", name: "Central Visayas" },
  { code: "08", name: "Eastern Visayas" },
  { code: "09", name: "Zamboanga Peninsula" },
  { code: "10", name: "Northern Mindanao" },
  { code: "11", name: "Davao Region" },
  { code: "12", name: "SOCCSKSARGEN" },
  { code: "13", name: "Caraga" },
  { code: "BARMM", name: "Bangsamoro Autonomous Region in Muslim Mindanao" },
];

export const islandGrouplist: CodeNameBase[] = [
  { code: "l", name: "Luzon" },
  { code: "v", name: "Visayas" },
  { code: "m", name: "Mindanao" },
];

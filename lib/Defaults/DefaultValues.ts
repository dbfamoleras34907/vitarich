import {
  Boxes,
  Calendar,
  Contact2,
  DockIcon,
  DollarSign,
  EggFried,
  FileSliders,
  Home,
  PenBoxIcon,
  ShoppingCartIcon,
  Wrench,
} from "lucide-react";
import { CodeNameBase } from "./DefaultTypes";

export const NavFolders = [
  {
    id: 0,
    title: "Home",
    url: "/home",
    icon: Home,
    items: [
      {
        group: "Reports",
        children: [{ type: "Report", title: "Dashboard", url: "/home" }],
      },
    ],
  },
  {
    id: 1,
    title: "Hatchery",
    url: "/a_dean/hatchery",
    icon: EggFried,
    items: [
      {
        group: "Hatchery Masters",
        children: [
          { type: "Module", title: "Receiving", url: "/a_dean/receiving" },

          {
            type: "Module",
            title: "Egg Classification",
            url: "/jmb/hatcheryclassi",
          },
          { type: "Module", title: "Egg Storage", url: "/jmb/eggstorage" },
          {
            type: "Module",
            title: "Egg Pre-Warming Process",
            url: "/jmb/prewarmingv2",
          },
          { type: "Module", title: "Egg Setter", url: "/jmb/eggsetter" },
          {
            type: "Module",
            title: "Egg Transfer Process",
            url: "/jmb/eggtransferv2",
          },
          {
            type: "Module",
            title: "Egg Hatcher Process",
            url: "/jmb/egghatcherv2",
          },
          {
            type: "Module",
            title: "Chick Pullout Process",
            url: "/jmb/chickpulloutv2",
          },
          {
            type: "Module",
            title: "Doc Classification",
            url: "/jmb/docclassification",
          },
          { type: "Module", title: "Doc Dispatch", url: "/jmb/docdispatchv2" },
          { type: "Module", title: "Disposal", url: "/a_dean/disposal" },
        ],
      },
      {
        group: "Reports",
        children: [
          { type: "Report", title: "Room Monitoring", url: "#" },
          { type: "Report", title: "Machine Monitoring", url: "#" },
        ],
      },
    ],
  },
  {
    id: 2,
    title: "Inventory Management",
    url: "/a_dean/inventory",
    icon: Boxes, // Example icon name
    items: [
      {
        group: "Item Management",
        children: [
          { type: "Module", title: "Item Master Data", url: "/a_dean/items" },
          {
            type: "Module",
            title: "Warehouse Master Data",
            url: "/a_dean/warehouse",
          },
          { type: "Module", title: "Bin  Master Data", url: "#" },
          // { type: "Module", title: "Alternative Items", url: "#" },
        ],
      },
      {
        group: "Inventory Transactions",
        children: [
          // { type: "Module", title: "Goods Receipt", url: "#" },
          // { type: "Module", title: "Goods Issue", url: "#" },
          { type: "Module", title: "Inventory", url: "/a_dean/inventory/inv" },
          { type: "Module", title: "Inventory Transfer", url: "#" },
          { type: "Module", title: "Inventory Transfer Request", url: "#" },
        ],
      },
      // {
      //   group: "Price Lists",
      //   children: [
      //     { type: "Module", title: "Price Lists", url: "/a_dean/price-lists" },
      //     { type: "Module", title: "Period and Volume Discounts", url: "/a_dean/discounts" },
      //     { type: "Module", title: "Special Prices", url: "/a_dean/special-prices" },
      //   ],
      // },
      {
        group: "Inventory Reports",
        children: [
          {
            type: "Report",
            title: "Inventory Posting Report",
            url: "/a_dean/invaudit",
          },
          { type: "Report", title: "Inventory Status", url: "#" },
          { type: "Report", title: "Warehouse Content List", url: "#" },
        ],
      },
    ],
  },
  {
    id: 3,
    title: "Workspace",
    url: "#",
    icon: Boxes, // Example icon name
    items: [
      {
        group: "Overview",
        children: [
          { type: "Module", title: "Projects", url: "" },
          { type: "Module", title: "Task", url: "" },
          { type: "Module", title: "Sprints", url: "" },
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
          { type: "Module", title: "User Management", url: "/admin/user" },
          { type: "Module", title: "Approval", url: "/admin/approval" },
          { type: "Module", title: "Farm Settings", url: "/a_dean/farm" },
          {
            type: "Module",
            title: "Broiler Settings",
            url: "/jmb/boilermasterdata",
          },
          { type: "Module", title: "General Settings", url: "#" },
          { type: "Module", title: "Document Settings", url: "#" },
          // { type: "Module", title: "User Details / Roles & Permissions", url: "/admin/user/new/" },
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

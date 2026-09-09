import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  ClipboardPenLine,
  Download,
  Drumstick,
  Egg,
  Factory,
  FileCog,
  FileSliders,
  FileText,
  FolderKanban,
  GitPullRequest,
  Home,
  LayoutDashboard,
  ListTodo,
  MapPinned,
  HeartPulse,
  Package,
  PackageSearch,
  Scale,
  ShieldCheck,
  Thermometer,
  Tractor,
  Truck,
  Upload,
  UserCog,
  Warehouse,
  Wheat,
  type LucideIcon,
} from "lucide-react"

const MODULE_ICON_RULES: Array<[string[], LucideIcon]> = [
  [["dashboard"], LayoutDashboard],
  [["user", "permission"], UserCog],
  [["approval"], ShieldCheck],
  [["farm"], Tractor],
  [["vaccination", "medication", "animal health"], HeartPulse],
  [["broiler", "flock"], Drumstick],
  [["warehouse"], Warehouse],
  [["bin"], Archive],
  [["item stock in", "goods receipt", "receiving"],Download],
  [["item stock out", "goods issue", "dispatch"],  Upload],
  [["item master", "item"], Package],
  [["uom", "unit"], Scale],
  [["conversion"], GitPullRequest],
  [["inventory map", "map"], MapPinned],
  [["inventory posting", "audit"], ClipboardCheck],
  [["inventory status", "inventory"], Boxes],
  [["transfer"], GitPullRequest],
  [["batch"], PackageSearch],
  [["placement"], ClipboardPenLine],
  [["growing"], Wheat],
  [["laying"], Egg],
  [["classification", "grading"], ClipboardList],
  [["storage"], Archive],
  [["pre-warming", "prewarming"], Thermometer],
  [["setter", "hatcher", "hatch"], Egg],
  [["pullout"], Truck],
  [["disposal"], Archive],
  [["project"], FolderKanban],
  [["task"], ListTodo],
  [["timesheet", "timeline"], CalendarClock],
  [["report"], BarChart3],
  [["document", "template"], FileCog],
  [["settings"], FileSliders],
  [["home"], Home],
  [["machine", "room"], Factory],
]

export function getModuleIcon(title: string, type?: string): LucideIcon {
  const normalizedTitle = title.toLowerCase()

  for (const [keywords, Icon] of MODULE_ICON_RULES) {
    if (keywords.some((keyword) => normalizedTitle.includes(keyword))) {
      return Icon
    }
  }

  return type === "Report" ? FileText : Package
}

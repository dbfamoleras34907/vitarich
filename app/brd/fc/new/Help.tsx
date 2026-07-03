"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const hotkeys = [
  {
    key: "Tab",
    description: "Move to the next editable cell.",
  },
  {
    key: "Shift + Tab",
    description: "Move to the previous editable cell.",
  },
  {
    key: "Enter",
    description: "Move down to the same editable column.",
  },
  {
    key: "Shift + Enter",
    description: "Move up to the same editable column.",
  },
  {
    key: "Arrow keys",
    description: "Move left, right, up, or down between editable cells.",
  },
];

export default function Help() {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Open help"
              className="relative z-[999] flex size-9 items-center justify-center rounded-full bg-[#e4e6eb] text-xl font-bold leading-none text-[#050505] transition hover:bg-[#d8dadf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877f2] focus-visible:ring-offset-2"
            >
              ?
            </button>
          </DialogTrigger>
        </TooltipTrigger>

        <TooltipContent>click for more information</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Use these keys to move through the editable cells.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {hotkeys.map((hotkey) => (
            <div
              key={hotkey.key}
              className="flex items-start justify-between gap-4 rounded-md border bg-slate-50 px-3 py-2"
            >
              <kbd className="shrink-0 rounded border bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-900 shadow-sm">
                {hotkey.key}
              </kbd>

              <p className="text-sm text-slate-600">{hotkey.description}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

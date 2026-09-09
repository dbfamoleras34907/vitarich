"use client";

import { Button } from "@/components/ui/button";
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
import { Keyboard } from "lucide-react";

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
            <Button
              aria-label="View keyboard shortcuts"
              variant={"ghost"}
              size={"sm"}
              className="text-muted-foreground"
            >
              <Keyboard className="size-4" />
              Shortcuts
            </Button>
          </DialogTrigger>
        </TooltipTrigger>

        <TooltipContent>View keyboard shortcuts</TooltipContent>
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
              className="flex items-start justify-between gap-4 rounded-md border bg-secondary/70 px-3 py-2"
            >
              <kbd className="shrink-0 rounded border bg-background px-2 py-1 font-mono text-xs font-semibold text-foreground shadow-sm">
                {hotkey.key}
              </kbd>

              <p className="text-sm text-muted-foreground">{hotkey.description}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}




"use client";
import React, { useEffect, useState } from "react"; // Added useState
import { createPortal } from "react-dom"; // Added createPortal
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function Modal({
  open = false,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ModalProps) {
  // 1. Handle Hydration (Next.js needs this for Portals)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const overlayRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
        document.body.style.overflow = "hidden";
    } else {
        document.body.style.overflow = "auto";
    }
  }, [open]);

  if (!open || !mounted) return null;

  // 2. Wrap the return in createPortal
  return createPortal(
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange?.(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div
        className={cn(
          "relative w-full max-w-lg rounded-lg bg-background shadow-xl transition-all animate-in fade-in-0 zoom-in-95",
          className
        )}
      >
        <button
          onClick={() => onOpenChange?.(false)}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>

        {(title || description) && (
          <div className="p-4">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        )}

        <div className="max-h-[80vh] overflow-auto">{children}</div>
      </div>
    </div>,
    document.body // This sends the modal to the root of the document
  );
}
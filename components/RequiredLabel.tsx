import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RequiredLabelProps = React.ComponentProps<typeof Label> & {
  required?: boolean;
  asteriskClassName?: string;
};

export default function RequiredLabel({
  children,
  required = true,
  className,
  asteriskClassName,
  ...props
}: RequiredLabelProps) {
  return (
    <Label className={cn("leading-none", className)} {...props}>
      {children}
      {required ? (
        <span
          className={cn("ml-1 text-red-500", asteriskClassName)}
          aria-hidden="true"
        >
          *
        </span>
      ) : null}
    </Label>
  );
}

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

export const BorderButton = ({
  children,
  variant = "outline",
  className,
}: {
  children: React.ReactNode;
  variant?:
    | "outline"
    | "default"
    | "destructive"
    | "secondary"
    | "ghost"
    | "link";
  className?: string;
}) => {
  return (
    <Button
      variant={variant}
      className={cn(className, "relative rounded-none !px-4 shadow-none")}
    >
      {children}
      <Illustration className="absolute right-0 bottom-0 size-3 scale-y-[-1] rotate-180" />
      <Illustration className="absolute bottom-0 left-0 size-3" />
      <Illustration className="absolute top-0 left-0 size-3 rotate-90" />
      <Illustration className="absolute top-0 right-0 size-3 scale-y-[-1] rotate-90" />
    </Button>
  );
};

const Illustration = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="12"
      height="13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0.857422 0.545898L0.857422 12.0889" stroke="currentColor" />
      <path d="M11.4355 11.5518H0.394532" stroke="currentColor" />
    </svg>
  );
};

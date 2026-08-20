import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import HistoryView from "./HistoryView";

export default function PlacementHistoryPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading history...</div>}>
      <HistoryView />
    </Suspense>
  );
}

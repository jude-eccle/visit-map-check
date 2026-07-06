import { STATUS_META, STATUS_ORDER, type PinStatus } from "@/lib/status";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function StatusSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (s: PinStatus) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-lg">이 위치의 상태를 선택하세요</SheetTitle>
        </SheetHeader>
        <div className="grid gap-2 mt-4 pb-4">
          {STATUS_ORDER.map((s) => {
            const m = STATUS_META[s];
            return (
              <button
                key={s}
                onClick={() => onPick(s)}
                className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent active:scale-[0.98] transition text-left"
              >
                <span
                  className="w-6 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-base">{m.label}</div>
                  <div className="text-sm text-muted-foreground">{m.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

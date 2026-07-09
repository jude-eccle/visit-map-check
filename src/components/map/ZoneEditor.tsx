import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMapImageUrl } from "@/lib/map-image";
import { MAX_ZONES, ZONE_STATUS_META, type ZoneStatus } from "@/lib/zones";

type ZoneRow = {
  id: string;
  map_id: string;
  name: string;
  x1_pct: number;
  y1_pct: number;
  x2_pct: number;
  y2_pct: number;
  status: ZoneStatus;
  order_idx: number;
};

export function ZoneEditor({
  mapId,
  mapImagePath,
  mapName,
  open,
  onOpenChange,
}: {
  mapId: string;
  mapImagePath: string | null;
  mapName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setImageUrl(await getMapImageUrl(mapImagePath));
      const { data } = await supabase
        .from("zones")
        .select("*")
        .eq("map_id", mapId)
        .order("order_idx");
      setZones((data ?? []) as ZoneRow[]);
      setLoading(false);
    })();
  }, [open, mapId, mapImagePath]);

  function pctFromEvent(e: React.PointerEvent) {
    const el = wrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function onDown(e: React.PointerEvent) {
    if (zones.length >= MAX_ZONES) return;
    const p = pctFromEvent(e);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = pctFromEvent(e);
    if (!p) return;
    setDrag({ ...drag, x2: p.x, y2: p.y });
  }
  async function onUp() {
    if (!drag) return;
    const w = Math.abs(drag.x2 - drag.x1);
    const h = Math.abs(drag.y2 - drag.y1);
    const d = drag;
    setDrag(null);
    if (w < 2 || h < 2) return; // ignore tiny
    const nextIdx = zones.length;
    const { data, error } = await supabase
      .from("zones")
      .insert({
        map_id: mapId,
        name: `구역${nextIdx + 1}`,
        x1_pct: d.x1,
        y1_pct: d.y1,
        x2_pct: d.x2,
        y2_pct: d.y2,
        order_idx: nextIdx,
      })
      .select("*")
      .single();
    if (error) return toast.error("구역 추가 실패");
    setZones((p) => [...p, data as ZoneRow]);
  }

  async function renameZone(z: ZoneRow, name: string) {
    const n = name.trim();
    if (!n || n === z.name) return;
    await supabase.from("zones").update({ name: n }).eq("id", z.id);
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, name: n } : x)));
  }

  async function delZone(z: ZoneRow) {
    await supabase.from("zones").delete().eq("id", z.id);
    setZones((p) => p.filter((x) => x.id !== z.id));
  }

  async function resetStatuses() {
    await supabase
      .from("zones")
      .update({ status: "unvisited" })
      .eq("map_id", mapId);
    setZones((p) => p.map((z) => ({ ...z, status: "unvisited" })));
    toast.success("모든 구역 상태를 미방문으로 초기화했어요.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mapName} — 구역 설정 (최대 {MAX_ZONES}개)</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              이미지 위에서 드래그해 사각형을 그리면 구역이 추가됩니다. ({zones.length}/{MAX_ZONES})
            </p>
            <div
              ref={wrapRef}
              className="relative w-full bg-muted rounded overflow-hidden select-none touch-none"
              style={{ aspectRatio: "4/3" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                  먼저 지도 이미지를 업로드해주세요.
                </div>
              )}
              {zones.map((z) => {
                const meta = ZONE_STATUS_META[z.status];
                const left = Math.min(z.x1_pct, z.x2_pct);
                const top = Math.min(z.y1_pct, z.y2_pct);
                const w = Math.abs(z.x2_pct - z.x1_pct);
                const h = Math.abs(z.y2_pct - z.y1_pct);
                return (
                  <div
                    key={z.id}
                    className="absolute flex items-center justify-center text-[11px] font-semibold pointer-events-none"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${w}%`,
                      height: `${h}%`,
                      backgroundColor: meta.fill,
                      border: `2px solid ${meta.color}`,
                      color: meta.color,
                    }}
                  >
                    <span className="bg-white/85 px-1 rounded">{z.name}</span>
                  </div>
                );
              })}
              {drag && (
                <div
                  className="absolute border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
                  style={{
                    left: `${Math.min(drag.x1, drag.x2)}%`,
                    top: `${Math.min(drag.y1, drag.y2)}%`,
                    width: `${Math.abs(drag.x2 - drag.x1)}%`,
                    height: `${Math.abs(drag.y2 - drag.y1)}%`,
                  }}
                />
              )}
            </div>
            <div className="space-y-1.5">
              {zones.map((z) => (
                <div key={z.id} className="flex items-center gap-2">
                  <Input
                    defaultValue={z.name}
                    onBlur={(e) => renameZone(z, e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-16">
                    {ZONE_STATUS_META[z.status].label}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => delZone(z)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" size="sm" onClick={resetStatuses}>
                모든 구역 상태 초기화
              </Button>
              <Button onClick={() => onOpenChange(false)}>닫기</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

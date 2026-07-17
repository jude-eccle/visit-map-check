import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateZone,
  adminDeleteZone,
  adminRenameZone,
  adminResetZoneStatuses,
  adminSwapZoneOrder,
  adminUpdateZoneLandmark,
} from "@/lib/admin-mutations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { ZONE_STATUS_META, type ZoneStatus } from "@/lib/zones";

type ZoneRow = {
  id: string;
  map_id: string;
  name: string;
  status: ZoneStatus;
  order_idx: number;
  landmark: string | null;
};


export function ZoneEditor({
  mapId,
  mapName,
  token,
  open,
  onOpenChange,
}: {
  mapId: string;
  mapImagePath?: string | null;
  mapName: string;
  token: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("zones")
        .select("id, map_id, name, status, order_idx, landmark")
        .eq("map_id", mapId)
        .order("order_idx");
      setZones((data ?? []) as ZoneRow[]);
      setLoading(false);
    })();
  }, [open, mapId]);

  async function updateLandmark(z: ZoneRow, v: string) {
    const val = v.trim();
    if (val === (z.landmark ?? "")) return;
    try {
      await adminUpdateZoneLandmark({ data: { token, id: z.id, landmark: val } });
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, landmark: val || null } : x)));
    } catch {
      toast.error("위치 힌트 저장 실패");
    }
  }


  async function addZone() {
    const nextIdx = zones.length;
    const name = newName.trim() || String.fromCharCode(65 + nextIdx);
    try {
      const row = await adminCreateZone({
        data: { token, mapId, name, orderIdx: nextIdx },
      });
      setZones((p) => [...p, row as ZoneRow]);
      setNewName("");
    } catch {
      toast.error("구역 추가 실패");
    }
  }

  async function renameZone(z: ZoneRow, name: string) {
    const n = name.trim();
    if (!n || n === z.name) return;
    try {
      await adminRenameZone({ data: { token, id: z.id, name: n } });
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, name: n } : x)));
    } catch {
      toast.error("이름 변경 실패");
    }
  }

  async function delZone(z: ZoneRow) {
    try {
      await adminDeleteZone({ data: { token, id: z.id } });
      setZones((p) => p.filter((x) => x.id !== z.id));
    } catch {
      toast.error("삭제 실패");
    }
  }

  async function move(z: ZoneRow, dir: -1 | 1) {
    const idx = zones.findIndex((x) => x.id === z.id);
    const j = idx + dir;
    if (j < 0 || j >= zones.length) return;
    const a = zones[idx];
    const b = zones[j];
    const next = [...zones];
    next[idx] = { ...b, order_idx: a.order_idx };
    next[j] = { ...a, order_idx: b.order_idx };
    setZones(next);
    try {
      await adminSwapZoneOrder({
        data: { token, aId: a.id, aOrder: a.order_idx, bId: b.id, bOrder: b.order_idx },
      });
    } catch {
      toast.error("순서 변경 실패");
    }
  }

  async function resetStatuses() {
    try {
      await adminResetZoneStatuses({ data: { token, mapId } });
      setZones((p) => p.map((z) => ({ ...z, status: "unvisited" })));
      toast.success("모든 구역 상태를 미방문으로 초기화했어요.");
    } catch {
      toast.error("초기화 실패");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mapName} — 구역 이름 관리</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              지도 이미지에 A/B/C 등 구역 표시를 미리 그려서 업로드하고, 여기서는 같은 이름만 등록하세요.
            </p>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`이름 (기본 ${String.fromCharCode(65 + zones.length)})`}
                className="h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addZone();
                  }
                }}
              />
              <Button size="sm" onClick={addZone}>
                <Plus className="w-4 h-4 mr-1" /> 추가
              </Button>
            </div>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {zones.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  아직 구역이 없습니다.
                </p>
              )}
              {zones.map((z, i) => (
                <div key={z.id} className="border rounded-md p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 text-xs text-muted-foreground text-right">{i + 1}.</span>
                    <Input
                      defaultValue={z.name}
                      onBlur={(e) => renameZone(z, e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground w-10">
                      {ZONE_STATUS_META[z.status].label}
                    </span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(z, -1)} disabled={i === 0}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(z, 1)} disabled={i === zones.length - 1}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => delZone(z)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 pl-7">
                    <Input
                      defaultValue={z.landmark ?? ""}
                      onBlur={(e) => updateLandmark(z, e.target.value)}
                      placeholder="위치 힌트 (선택) 예: 용화W펜션 부근"
                      className="h-8 text-xs flex-1"
                    />
                  </div>
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

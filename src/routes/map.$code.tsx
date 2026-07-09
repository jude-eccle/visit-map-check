import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  ZONE_STATUS_META,
  type Category,
  type ZoneStatus,
} from "@/lib/zones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getMapImageUrl } from "@/lib/map-image";
import { getLeaderPhone } from "@/lib/settings.functions";
import { AssignmentBanner } from "@/components/AssignmentBanner";

export const Route = createFileRoute("/map/$code")({
  component: MapPage,
});

type MapRow = {
  id: string;
  code: string;
  name: string;
  image_path: string | null;
  total_houses: number;
};

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

type EventRow = {
  id: string;
  zone_id: string;
  map_id: string;
  team_name: string;
  category: Category;
  created_at: string;
};

function MapPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [teamName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("teamName") ?? "" : ""
  );
  const [map, setMap] = useState<MapRow | null>(null);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [leaderPhone, setLeaderPhone] = useState("");
  const [confirmRevertZone, setConfirmRevertZone] = useState<ZoneRow | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    (async () => {
      if (!teamName) {
        navigate({ to: "/" });
        return;
      }
      setLoading(true);
      const { data: m } = await supabase
        .from("maps")
        .select("id, code, name, image_path, total_houses")
        .eq("code", code)
        .maybeSingle();
      if (!m) {
        setLoading(false);
        throw notFound();
      }
      setMap(m as MapRow);
      setImageUrl(await getMapImageUrl(m.image_path));
      const [{ data: zs }, { data: es }, ph] = await Promise.all([
        supabase.from("zones").select("*").eq("map_id", m.id).order("order_idx"),
        supabase.from("zone_events").select("*").eq("map_id", m.id),
        getLeaderPhone().catch(() => ({ value: "" })),
      ]);
      setZones((zs ?? []) as ZoneRow[]);
      setEvents((es ?? []) as EventRow[]);
      setLeaderPhone(ph?.value ?? "");
      setLoading(false);
    })();
  }, [code, teamName, navigate]);

  useEffect(() => {
    if (!map) return;
    const ch = supabase
      .channel(`map-${map.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zones", filter: `map_id=eq.${map.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setZones((p) => {
              const r = payload.new as ZoneRow;
              if (p.some((z) => z.id === r.id)) return p;
              return [...p, r].sort((a, b) => a.order_idx - b.order_idx);
            });
          } else if (payload.eventType === "UPDATE") {
            const r = payload.new as ZoneRow;
            setZones((p) => p.map((z) => (z.id === r.id ? r : z)));
          } else if (payload.eventType === "DELETE") {
            const r = payload.old as { id: string };
            setZones((p) => p.filter((z) => z.id !== r.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zone_events", filter: `map_id=eq.${map.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setEvents((p) => {
              const r = payload.new as EventRow;
              if (p.some((e) => e.id === r.id)) return p;
              return [...p, r];
            });
          } else if (payload.eventType === "DELETE") {
            const r = payload.old as { id: string };
            setEvents((p) => p.filter((e) => e.id !== r.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [map]);

  const zoneStats = useMemo(() => {
    const m = new Map<string, { total: number; by: Record<Category, number> }>();
    for (const z of zones) m.set(z.id, { total: 0, by: { done: 0, gift: 0, away: 0, other: 0 } });
    for (const e of events) {
      const s = m.get(e.zone_id);
      if (!s) continue;
      s.total += 1;
      s.by[e.category] += 1;
    }
    return m;
  }, [zones, events]);

  useEffect(() => {
    if (selectedZoneId && zones.some((z) => z.id === selectedZoneId && z.status === "in_progress")) return;
    const first = zones.find((z) => z.status === "in_progress");
    setSelectedZoneId(first?.id ?? null);
  }, [zones, selectedZoneId]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selStats = selectedZone
    ? zoneStats.get(selectedZone.id) ?? { total: 0, by: { done: 0, gift: 0, away: 0, other: 0 } }
    : null;

  async function cycleZone(z: ZoneRow) {
    if (z.status === "done") {
      setConfirmRevertZone(z);
      return;
    }
    const next: ZoneStatus = z.status === "unvisited" ? "in_progress" : "unvisited";
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: next } : x)));
    if (next === "in_progress") setSelectedZoneId(z.id);
    else if (selectedZoneId === z.id) setSelectedZoneId(null);

    const { error } = await supabase.from("zones").update({ status: next }).eq("id", z.id);
    if (error) {
      toast.error("상태 변경 실패");
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: z.status } : x)));
      return;
    }
    if (next === "in_progress") toast(`${z.name} 방문중`);
  }

  async function completeZone(z: ZoneRow) {
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: "done" } : x)));
    const { error } = await supabase.from("zones").update({ status: "done" }).eq("id", z.id);
    if (error) {
      toast.error("완료 처리 실패");
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: z.status } : x)));
      return;
    }
    const stats = zoneStats.get(z.id) ?? { total: 0, by: { done: 0, gift: 0, away: 0, other: 0 } };
    await supabase.from("zone_completions").insert({
      zone_id: z.id,
      map_id: z.map_id,
      team_name: teamName,
      counters: { total: stats.total, ...stats.by },
    });
    toast.success(`${z.name} 완료 — 팀장에게 알림 전송`);
  }

  async function revertZoneToInProgress(z: ZoneRow) {
    setConfirmRevertZone(null);
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: "in_progress" } : x)));
    setSelectedZoneId(z.id);
    const { error } = await supabase.from("zones").update({ status: "in_progress" }).eq("id", z.id);
    if (error) {
      toast.error("되돌리기 실패");
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: "done" } : x)));
    }
  }

  async function addEvent(cat: Category) {
    if (!selectedZone || !map) return;
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    const optimistic: EventRow = {
      id: tempId,
      zone_id: selectedZone.id,
      map_id: map.id,
      team_name: teamName,
      category: cat,
      created_at: now,
    };
    setEvents((p) => [...p, optimistic]);
    let currentId = tempId;
    let undone = false;
    const undo = async () => {
      if (undone) return;
      undone = true;
      const id = currentId;
      setEvents((p) => p.filter((e) => e.id !== id));
      if (!id.startsWith("tmp-")) {
        await supabase.from("zone_events").delete().eq("id", id);
      }
    };
    toast(`+1 ${CATEGORY_META[cat].label}`, {
      duration: 5000,
      action: { label: "되돌리기", onClick: undo },
    });
    const { data, error } = await supabase
      .from("zone_events")
      .insert({
        zone_id: selectedZone.id,
        map_id: map.id,
        team_name: teamName,
        category: cat,
      })
      .select("*")
      .single();
    if (error) {
      toast.error("저장 실패");
      setEvents((p) => p.filter((e) => e.id !== tempId));
      return;
    }
    if (undone) {
      await supabase.from("zone_events").delete().eq("id", data.id);
      return;
    }
    currentId = data.id;
    setEvents((p) => p.map((e) => (e.id === tempId ? (data as EventRow) : e)));
  }

  function callLeader() {
    const digits = leaderPhone.replace(/[^\d+]/g, "");
    if (!digits) {
      toast.error("팀장 전화번호가 아직 등록되지 않았어요. 관리자에게 문의하세요.");
      return;
    }
    window.location.href = `tel:${digits}`;
  }

  function handleLeaveMap() {
    const incomplete = zones.filter((z) => z.status !== "done").length;
    if (incomplete > 0) {
      setConfirmLeave(true);
      return;
    }
    navigate({ to: "/" });
  }

  const totalStats = useMemo(() => {
    const by: Record<Category, number> = { done: 0, gift: 0, away: 0, other: 0 };
    for (const e of events) by[e.category] += 1;
    const doneCount = zones.filter((z) => z.status === "done").length;
    return { total: events.length, by, doneZones: doneCount, totalZones: zones.length };
  }, [events, zones]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!map) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex-shrink-0 bg-card border-b px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base truncate">{map.name}</h1>
              <span className="text-xs text-muted-foreground">코드 {map.code}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{teamName}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              완료 {totalStats.doneZones}/{totalStats.totalZones}
            </div>
            <div className="text-[10px] text-muted-foreground">시도 {totalStats.total}</div>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap text-[11px]">
          {CATEGORY_ORDER.map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 rounded font-medium tabular-nums"
              style={{ backgroundColor: `${CATEGORY_META[c].color}22`, color: CATEGORY_META[c].color }}
            >
              {CATEGORY_META[c].short} {totalStats.by[c]}
            </span>
          ))}
        </div>
        {teamName && (
          <div className="px-2 pt-2">
            <AssignmentBanner teamName={teamName} />
          </div>
        )}
      </header>

      <div className="relative bg-muted flex items-center justify-center p-2">
        <div className="relative inline-block max-w-full">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={map.name}
              className="block w-full max-w-full h-auto select-none"
              draggable={false}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="w-[90vw] max-w-2xl aspect-[4/3] bg-white border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
              지도 이미지가 업로드되지 않았어요.
            </div>
          )}
          {imageLoaded && (
            <div className="absolute inset-0">
              {zones.map((z) => {
                const meta = ZONE_STATUS_META[z.status];
                const left = Math.min(z.x1_pct, z.x2_pct);
                const top = Math.min(z.y1_pct, z.y2_pct);
                const w = Math.abs(z.x2_pct - z.x1_pct);
                const h = Math.abs(z.y2_pct - z.y1_pct);
                const isSel = z.id === selectedZoneId;
                const st = zoneStats.get(z.id);
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => cycleZone(z)}
                    className="absolute flex flex-col items-center justify-center text-center p-0 m-0"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${w}%`,
                      height: `${h}%`,
                      backgroundColor: meta.fill,
                      border: `${isSel ? 3 : 2}px solid ${meta.color}`,
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className="font-bold whitespace-nowrap px-1.5 py-0.5 rounded bg-white/85 text-[11px] leading-tight"
                      style={{ color: meta.color }}
                    >
                      {z.name} · {meta.label}
                    </span>
                    {st && st.total > 0 && (
                      <span className="mt-0.5 px-1 rounded bg-black/60 text-white tabular-nums text-[10px]">
                        시도 {st.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {zones.length === 0 && (
          <div className="absolute inset-x-4 top-4 bg-card/95 border rounded-lg p-3 text-sm text-center text-muted-foreground">
            아직 이 지도에 구역이 설정되지 않았어요. 관리자 화면에서 구역을 등록해주세요.
          </div>
        )}
      </div>

      <footer className="flex-shrink-0 bg-card border-t sticky bottom-0">
        {selectedZone && selStats ? (
          <div className="p-2 space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span
                className="w-3 h-3 rounded"
                style={{ backgroundColor: ZONE_STATUS_META.in_progress.color }}
              />
              <span className="font-semibold text-sm truncate">
                현재 작업 중: {selectedZone.name}
              </span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                시도 {selStats.total}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_ORDER.map((c) => {
                const meta = CATEGORY_META[c];
                return (
                  <button
                    key={c}
                    onClick={() => addEvent(c)}
                    className="h-16 rounded-lg font-semibold text-white flex flex-col items-center justify-center active:scale-[0.98] transition"
                    style={{ backgroundColor: meta.color }}
                  >
                    <span className="text-sm leading-tight">{meta.label}</span>
                    <span className="text-xs opacity-90 tabular-nums">{selStats.by[c]}건</span>
                  </button>
                );
              })}
            </div>
            <Button
              onClick={() => completeZone(selectedZone)}
              className="w-full h-14 text-base font-bold"
              style={{ backgroundColor: ZONE_STATUS_META.done.color, color: "white" }}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" /> 이 구역 완료
            </Button>
          </div>
        ) : (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {zones.some((z) => z.status === "in_progress")
              ? "위에서 방문중인 구역을 눌러 선택하세요."
              : "구역을 탭해 '방문중'으로 표시하면 카운터가 열립니다."}
          </div>
        )}
        <div className="border-t p-2 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 text-sm" onClick={callLeader}>
            <Phone className="w-4 h-4 mr-1" /> 📞 팀장님께 전화
          </Button>
          <Button variant="outline" className="h-11 text-sm" onClick={handleLeaveMap}>
            <ArrowLeft className="w-4 h-4 mr-1" /> 다른 지도
          </Button>
        </div>
      </footer>

      <Dialog open={!!confirmRevertZone} onOpenChange={(o) => !o && setConfirmRevertZone(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>완료를 취소할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{confirmRevertZone?.name}" 구역을 다시 <b>방문중</b> 상태로 되돌립니다.
            (이미 전송된 완료 알림은 팀장 대시보드에 남아있을 수 있어요.)
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmRevertZone(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRevertZone && revertZoneToInProgress(confirmRevertZone)}
            >
              완료 취소하고 방문중으로
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>정말 이동할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            아직 완료되지 않은 구역이 있습니다 (
            {zones.filter((z) => z.status !== "done").length}개). 그래도 이동하시겠습니까?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                setConfirmLeave(false);
                navigate({ to: "/" });
              }}
            >
              이동
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

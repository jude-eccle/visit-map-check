import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, HandHelping, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { CATEGORY_META, CATEGORY_ORDER, type Category } from "@/lib/zones";

export const Route = createFileRoute("/leader")({
  component: LeaderDashboard,
});

type MapRow = { id: string; code: string; name: string };
type ZoneRow = { id: string; map_id: string; name: string; status: string };
type EventRow = { id: string; map_id: string; zone_id: string; category: Category };
type SupportRow = {
  id: string;
  map_id: string;
  team_name: string;
  created_at: string;
  resolved: boolean;
};
type CompletionRow = {
  id: string;
  map_id: string;
  zone_id: string;
  team_name: string;
  counters: Record<string, number>;
  acknowledged: boolean;
  created_at: string;
};

function LeaderDashboard() {
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [supports, setSupports] = useState<SupportRow[]>([]);
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [{ data: m }, { data: z }, { data: e }, { data: s }, { data: c }] =
      await Promise.all([
        supabase.from("maps").select("id, code, name").order("code"),
        supabase.from("zones").select("id, map_id, name, status"),
        supabase.from("zone_events").select("id, map_id, zone_id, category"),
        supabase
          .from("support_requests")
          .select("*")
          .eq("resolved", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("zone_completions")
          .select("*")
          .eq("acknowledged", false)
          .order("created_at", { ascending: false }),
      ]);
    setMaps((m ?? []) as MapRow[]);
    setZones((z ?? []) as ZoneRow[]);
    setEvents((e ?? []) as EventRow[]);
    setSupports((s ?? []) as SupportRow[]);
    setCompletions((c ?? []) as CompletionRow[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("leader-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "zones" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "zone_events" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "zone_completions" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_requests" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "maps" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const stats = useMemo(() => {
    const m = new Map<
      string,
      { doneZones: number; totalZones: number; total: number; by: Record<Category, number> }
    >();
    for (const map of maps) {
      m.set(map.id, {
        doneZones: 0,
        totalZones: 0,
        total: 0,
        by: { done: 0, gift: 0, away: 0, other: 0 },
      });
    }
    for (const z of zones) {
      const s = m.get(z.map_id);
      if (!s) continue;
      s.totalZones += 1;
      if (z.status === "done") s.doneZones += 1;
    }
    for (const e of events) {
      const s = m.get(e.map_id);
      if (!s) continue;
      s.total += 1;
      s.by[e.category] += 1;
    }
    return m;
  }, [maps, zones, events]);

  const supportByMap = useMemo(() => {
    const g = new Map<string, SupportRow[]>();
    for (const s of supports) {
      const l = g.get(s.map_id) ?? [];
      l.push(s);
      g.set(s.map_id, l);
    }
    return g;
  }, [supports]);

  const completionsByMap = useMemo(() => {
    const g = new Map<string, CompletionRow[]>();
    for (const c of completions) {
      const l = g.get(c.map_id) ?? [];
      l.push(c);
      g.set(c.map_id, l);
    }
    return g;
  }, [completions]);

  const zoneNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of zones) m.set(z.id, z.name);
    return m;
  }, [zones]);

  async function resolveSupport(id: string) {
    await supabase.from("support_requests").update({ resolved: true }).eq("id", id);
    refresh();
  }
  async function ackCompletion(id: string) {
    await supabase.from("zone_completions").update({ acknowledged: true }).eq("id", id);
    refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">팀장 대시보드</h1>
            <p className="text-xs text-muted-foreground">지도별 진행 상황 · 실시간</p>
          </div>
          {completions.length > 0 && (
            <span className="bg-status-done text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              완료알림 {completions.length}
            </span>
          )}
          {supports.length > 0 && (
            <span className="bg-status-refuse text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              지원 {supports.length}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : maps.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
            등록된 지도가 없어요.
          </div>
        ) : (
          maps.map((map) => {
            const s = stats.get(map.id)!;
            const reqs = supportByMap.get(map.id) ?? [];
            const comps = completionsByMap.get(map.id) ?? [];
            return (
              <div key={map.id} className="bg-card border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base truncate">{map.name}</h2>
                    <div className="text-xs text-muted-foreground">코드 {map.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">
                      {s.doneZones}/{s.totalZones}
                    </div>
                    <div className="text-[10px] text-muted-foreground">완료 구역</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {CATEGORY_ORDER.map((c) => (
                    <div
                      key={c}
                      className="rounded-lg py-1.5"
                      style={{ backgroundColor: `${CATEGORY_META[c].color}18` }}
                    >
                      <div
                        className="text-lg font-bold tabular-nums"
                        style={{ color: CATEGORY_META[c].color }}
                      >
                        {s.by[c]}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {CATEGORY_META[c].short}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  총 시도 {s.total}건
                </div>

                {comps.length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    {comps.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 bg-status-done/10 rounded-lg p-2.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-status-done flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="font-medium">
                            {zoneNameById.get(c.zone_id) ?? "구역"} 완료 · {c.team_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" · "}
                            시도 {c.counters?.total ?? 0} ·{" "}
                            {CATEGORY_ORDER.map(
                              (k) => `${CATEGORY_META[k].short} ${c.counters?.[k] ?? 0}`
                            ).join(" / ")}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => ackCompletion(c.id)}>
                          확인함
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {reqs.length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    {reqs.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 bg-status-refuse/10 rounded-lg p-2.5"
                      >
                        <HandHelping className="w-4 h-4 text-status-refuse flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="font-medium truncate">{r.team_name} 지원 요청</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => resolveSupport(r.id)}>
                          해결됨
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, HandHelping, Loader2, MapPin, CheckCircle2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_META, CATEGORY_ORDER, type Category } from "@/lib/zones";
import { getMapImageUrl } from "@/lib/map-image";

export const Route = createFileRoute("/leader")({
  component: LeaderDashboard,
});

type MapRow = { id: string; code: string; name: string; address: string; place_name: string | null };
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
type AssignmentRow = {
  id: string;
  team_name: string;
  map_id: string;
  status: "pending" | "acknowledged" | "superseded" | "cancelled";
  assigned_at: string;
};
type HandoffRow = {
  id: string;
  zone_id: string;
  map_id: string;
  team_name: string;
  kind: "complete" | "handoff";
  note: string;
  photo_url: string | null;
  created_at: string;
};

type TeamNameRow = { id: string; name: string; order_idx: number };

function LeaderDashboard() {
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [supports, setSupports] = useState<SupportRow[]>([]);
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRow[]>([]);
  const [teamNames, setTeamNames] = useState<TeamNameRow[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [handoffsModal, setHandoffsModal] = useState<{ zoneId: string; zoneName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  // assignFor: legacy per-completion selector picks a map for a fixed team;
  // assignMapFor: per-map selector picks a team for a fixed map.
  const [assignFor, setAssignFor] = useState<{ team: string } | null>(null);
  const [assignMapFor, setAssignMapFor] = useState<MapRow | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  async function downloadExcel() {
    setExportLoading(true);
    try {
      const [xlsx, detailRes] = await Promise.all([
        import("xlsx"),
        supabase
          .from("zone_events")
          .select("id, map_id, zone_id, category, team_name, decided, source, created_at")
          .order("created_at", { ascending: true }),
      ]);
      const details = (detailRes.data ?? []) as Array<{
        id: string;
        map_id: string;
        zone_id: string | null;
        category: Category;
        team_name: string;
        decided: boolean | null;
        source: string | null;
        created_at: string;
      }>;
      const mapById = new Map(maps.map((m) => [m.id, m]));
      const zoneName = (id: string | null) => (id ? zoneNameById.get(id) ?? "-" : "(수기)");
      const catLabel = (c: Category) => CATEGORY_META[c]?.label ?? c;
      const summaryRows: Array<Record<string, string | number>> = [];
      let tTot = 0, tDone = 0, tDec = 0, tGift = 0, tAway = 0, tOther = 0, tZoneDone = 0, tZoneAll = 0;
      for (const m of maps) {
        const rows = details.filter((d) => d.map_id === m.id);
        const done = rows.filter((r) => r.category === "done").length;
        const decided = rows.filter((r) => r.category === "done" && r.decided === true).length;
        const gift = rows.filter((r) => r.category === "gift").length;
        const away = rows.filter((r) => r.category === "away").length;
        const other = rows.filter((r) => r.category === "other").length;
        const st = stats.get(m.id);
        const zoneAll = st?.totalZones ?? 0;
        const zoneDone = st?.doneZones ?? 0;
        summaryRows.push({
          지도명: m.name,
          코드: m.code,
          "장소 이름": m.place_name ?? "",
          "총 방문 시도": rows.length,
          "복음 전달 완료": done,
          "그 중 결신": decided,
          "선물만 전달": gift,
          부재중: away,
          기타: other,
          "완료 구역": `${zoneDone}/${zoneAll}`,
        });
        tTot += rows.length; tDone += done; tDec += decided; tGift += gift; tAway += away; tOther += other;
        tZoneDone += zoneDone; tZoneAll += zoneAll;
      }
      summaryRows.push({
        지도명: "합계", 코드: "", "장소 이름": "",
        "총 방문 시도": tTot, "복음 전달 완료": tDone, "그 중 결신": tDec,
        "선물만 전달": tGift, 부재중: tAway, 기타: tOther,
        "완료 구역": `${tZoneDone}/${tZoneAll}`,
      });
      const detailRows = details.map((d) => ({
        지도명: mapById.get(d.map_id)?.name ?? "",
        구역명: zoneName(d.zone_id),
        "조 이름": d.team_name,
        상태: catLabel(d.category),
        "결신 여부": d.category === "done" ? (d.decided === true ? "결신" : d.decided === false ? "비결신" : "미응답") : "",
        "기록 방식": d.source === "manual" ? "수기" : "앱",
        시각: new Date(d.created_at).toLocaleString("ko-KR"),
      }));
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(summaryRows), "요약");
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(detailRows), "상세");
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      xlsx.writeFile(wb, `전체결과_${stamp}.xlsx`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다운로드 실패");
    } finally {
      setExportLoading(false);
    }
  }

  async function refresh() {
    const [{ data: m }, { data: z }, { data: e }, { data: s }, { data: c }, { data: a }, hRes] =
      await Promise.all([
        supabase.from("maps").select("id, code, name, address, place_name").order("code"),
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
        supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("assignments" as any)
          .select("*")
          .in("status", ["pending", "acknowledged"]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("handoffs" as any).select("*").order("created_at", { ascending: false })) as unknown as Promise<{ data: HandoffRow[] | null }>,
      ]);
    setMaps((m ?? []) as MapRow[]);
    setZones((z ?? []) as ZoneRow[]);
    setEvents((e ?? []) as EventRow[]);
    setSupports((s ?? []) as SupportRow[]);
    setCompletions((c ?? []) as CompletionRow[]);
    setAssignments((a ?? []) as unknown as AssignmentRow[]);
    setHandoffs((hRes.data ?? []) as HandoffRow[]);
    setLoading(false);
    const { data: tn } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("team_names" as any)
      .select("id, name, order_idx")
      .order("order_idx");
    setTeamNames(((tn ?? []) as unknown) as TeamNameRow[]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "maps" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "handoffs" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_names" }, () => refresh())
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

  const latestHandoffByZoneTeam = useMemo(() => {
    const m = new Map<string, HandoffRow>();
    for (const h of handoffs) {
      const key = `${h.zone_id}|${h.team_name}`;
      const prev = m.get(key);
      if (!prev || new Date(h.created_at) > new Date(prev.created_at)) m.set(key, h);
    }
    return m;
  }, [handoffs]);

  const handoffsByZone = useMemo(() => {
    const m = new Map<string, HandoffRow[]>();
    for (const h of handoffs) {
      const arr = m.get(h.zone_id) ?? [];
      arr.push(h);
      m.set(h.zone_id, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return m;
  }, [handoffs]);

  useEffect(() => {
    const missing = handoffs
      .map((h) => h.photo_url)
      .filter((p): p is string => !!p && !thumbUrls[p]);
    if (missing.length === 0) return;
    (async () => {
      const entries: Record<string, string> = {};
      await Promise.all(
        missing.map(async (p) => {
          const u = await getMapImageUrl(p);
          if (u) entries[p] = u;
        })
      );
      if (Object.keys(entries).length) setThumbUrls((prev) => ({ ...prev, ...entries }));
    })();
  }, [handoffs, thumbUrls]);


  async function resolveSupport(id: string) {
    await supabase.from("support_requests").update({ resolved: true }).eq("id", id);
    refresh();
  }
  async function ackCompletion(id: string) {
    await supabase.from("zone_completions").update({ acknowledged: true }).eq("id", id);
    refresh();
  }

  const mapById = useMemo(() => {
    const m = new Map<string, MapRow>();
    for (const x of maps) m.set(x.id, x);
    return m;
  }, [maps]);

  const pendingByTeam = useMemo(() => {
    const m = new Map<string, AssignmentRow>();
    for (const a of assignments) {
      const prev = m.get(a.team_name);
      if (!prev || new Date(a.assigned_at) > new Date(prev.assigned_at)) m.set(a.team_name, a);
    }
    return m;
  }, [assignments]);

  const activeByMap = useMemo(() => {
    const g = new Map<string, AssignmentRow[]>();
    // Only show each team's LATEST active assignment against its current map
    for (const a of pendingByTeam.values()) {
      const l = g.get(a.map_id) ?? [];
      l.push(a);
      g.set(a.map_id, l);
    }
    return g;
  }, [pendingByTeam]);

  async function assignMap(team: string, mapId: string) {
    const { error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("assignments" as any)
      .insert({ team_name: team, map_id: mapId } as never);
    if (error) {
      toast.error("배정 실패");
      return;
    }
    setAssignFor(null);
    setAssignMapFor(null);
    toast.success(`${team} → ${mapById.get(mapId)?.name} 배정 완료`);
    refresh();
  }

  async function cancelAssignment(a: AssignmentRow) {
    const mapName = mapById.get(a.map_id)?.name ?? "이 지도";
    if (!confirm(`${a.team_name}의 ${mapName} 배정을 취소할까요?`)) return;
    const { error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("assignments" as any)
      .update({ status: "cancelled" })
      .eq("id", a.id);
    if (error) {
      toast.error("취소 실패");
      return;
    }
    toast.success(`${a.team_name} 배정 취소됨`);
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
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={downloadExcel} disabled={exportLoading}>
            {exportLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : "📊"} 전체 결과 엑셀 다운로드
          </Button>
        </div>
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
                    {map.place_name && (
                      <div className="text-xs text-foreground/80 truncate">🏷️ {map.place_name}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      코드 {map.code}
                      {map.address ? ` · 📍 ${map.address}` : ""}
                    </div>

                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">
                      {s.doneZones}/{s.totalZones}
                    </div>
                    <div className="text-[10px] text-muted-foreground">완료 구역</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setAssignMapFor(map)}
                >
                  <Send className="w-3.5 h-3.5 mr-1" /> 다음 지도 배정 ({map.name})
                </Button>
                {(() => {
                  const active = activeByMap.get(map.id) ?? [];
                  if (active.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="text-muted-foreground self-center">배정됨:</span>
                      {active.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 border rounded-full pl-2 pr-1 py-0.5 bg-accent/40"
                        >
                          <span className="font-medium">{a.team_name}</span>
                          <span
                            className={
                              a.status === "acknowledged"
                                ? "text-status-done text-[10px]"
                                : "text-muted-foreground text-[10px]"
                            }
                          >
                            {a.status === "acknowledged" ? "확인함" : "대기중"}
                          </span>
                          <button
                            type="button"
                            aria-label="배정 취소"
                            onClick={() => cancelAssignment(a)}
                            className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  );
                })()}
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
                    {comps.map((c) => {
                      const h = latestHandoffByZoneTeam.get(`${c.zone_id}|${c.team_name}`);
                      const thumb = h?.photo_url ? thumbUrls[h.photo_url] : null;
                      const zName = zoneNameById.get(c.zone_id) ?? "구역";
                      const recCount = handoffsByZone.get(c.zone_id)?.length ?? 0;
                      return (
                        <div
                          key={c.id}
                          className="flex items-start gap-2 bg-status-done/10 rounded-lg p-2.5"
                        >
                          {thumb ? (
                            <button
                              type="button"
                              onClick={() => setPhotoModal(thumb)}
                              className="flex-shrink-0"
                            >
                              <img src={thumb} alt="" className="w-12 h-12 object-cover rounded border" />
                            </button>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-status-done flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0 text-sm">
                            <div className="font-medium">
                              {zName} · {c.team_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" · "}
                              {CATEGORY_ORDER.map(
                                (k) => `${CATEGORY_META[k].short} ${c.counters?.[k] ?? 0}`
                              ).join(" / ")}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {recCount > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setHandoffsModal({ zoneId: c.zone_id, zoneName: zName })}
                              >
                                기록 {recCount}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => ackCompletion(c.id)}>
                              확인함
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assignFor?.team} 팀에게 다음 지도 배정
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {maps.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => assignFor && assignMap(assignFor.team, m.id)}
                className="w-full text-left border rounded-lg p-3 hover:bg-accent transition"
              >
                <div className="font-semibold text-sm">
                  {m.name} <span className="text-xs font-mono text-muted-foreground">코드 {m.code}</span>
                </div>
                {m.place_name && (
                  <div className="text-xs text-foreground/80 mt-0.5">🏷️ {m.place_name}</div>
                )}
                {m.address && (
                  <div className="text-xs text-muted-foreground mt-0.5">📍 {m.address}</div>
                )}

              </button>
            ))}
            {maps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                등록된 지도가 없습니다.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignMapFor} onOpenChange={(o) => !o && setAssignMapFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assignMapFor?.name} <span className="text-xs font-mono text-muted-foreground">코드 {assignMapFor?.code}</span> — 조 선택
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {teamNames.map((t) => {
              const p = pendingByTeam.get(t.name);
              const pMap = p ? mapById.get(p.map_id) : null;
              const alreadyThis = pMap && assignMapFor && pMap.id === assignMapFor.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => assignMapFor && assignMap(t.name, assignMapFor.id)}
                  className="w-full text-left border rounded-lg p-3 hover:bg-accent transition flex items-center justify-between gap-2"
                >
                  <div className="font-semibold text-sm">{t.name}</div>
                  {pMap && (
                    <div className={`text-[11px] ${alreadyThis ? "text-status-done" : "text-primary"}`}>
                      {alreadyThis ? "이미 이 지도 배정됨" : `이미 ${pMap.name}에 배정됨`}
                    </div>
                  )}
                </button>
              );
            })}
            {teamNames.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                등록된 조가 없습니다. 관리자 화면에서 추가하세요.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>



      <Dialog open={!!handoffsModal} onOpenChange={(o) => !o && setHandoffsModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{handoffsModal?.zoneName} — 전체 기록</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {(handoffsModal ? handoffsByZone.get(handoffsModal.zoneId) ?? [] : []).map((h) => {
              const thumb = h.photo_url ? thumbUrls[h.photo_url] : null;
              return (
                <div key={h.id} className="border rounded-lg p-2.5 flex gap-2 items-start">
                  {thumb ? (
                    <button type="button" onClick={() => setPhotoModal(thumb)} className="flex-shrink-0">
                      <img src={thumb} alt="" className="w-16 h-16 object-cover rounded border" />
                    </button>
                  ) : (
                    <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">
                      사진 없음
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-sm space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{h.team_name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          h.kind === "complete"
                            ? "bg-status-done/15 text-status-done"
                            : "bg-primary/15 text-primary"
                        }`}
                      >
                        {h.kind === "complete" ? "완료" : "교대 인계"}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {new Date(h.created_at).toLocaleString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {h.note && <div className="text-xs whitespace-pre-wrap break-words">{h.note}</div>}
                  </div>
                </div>
              );
            })}
            {handoffsModal && (handoffsByZone.get(handoffsModal.zoneId)?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">기록이 없습니다.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!photoModal} onOpenChange={(o) => !o && setPhotoModal(null)}>
        <DialogContent className="sm:max-w-lg p-2 bg-black">
          {photoModal && (
            <img src={photoModal} alt="" className="w-full h-auto max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, HandHelping, Loader2, MapPin } from "lucide-react";
import type { PinStatus } from "@/lib/status";

export const Route = createFileRoute("/leader")({
  component: LeaderDashboard,
});

type MapRow = {
  id: string;
  code: string;
  name: string;
  total_houses: number;
};
type PinRow = { id: string; map_id: string; status: PinStatus };
type SupportRow = {
  id: string;
  map_id: string;
  team_name: string;
  created_at: string;
  resolved: boolean;
};

function LeaderDashboard() {
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [supports, setSupports] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [{ data: m }, { data: p }, { data: s }] = await Promise.all([
      supabase.from("maps").select("id, code, name, total_houses").order("code"),
      supabase.from("pins").select("id, map_id, status"),
      supabase
        .from("support_requests")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false }),
    ]);
    setMaps((m ?? []) as MapRow[]);
    setPins((p ?? []) as PinRow[]);
    setSupports((s ?? []) as SupportRow[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("leader-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "pins" }, () => refresh())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_requests" },
        () => refresh()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "maps" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const byMap = useMemo(() => {
    const grouped = new Map<string, { total: number; skip: number }>();
    for (const p of pins) {
      const cur = grouped.get(p.map_id) ?? { total: 0, skip: 0 };
      cur.total += 1;
      if (p.status === "skip") cur.skip += 1;
      grouped.set(p.map_id, cur);
    }
    return grouped;
  }, [pins]);

  const supportByMap = useMemo(() => {
    const g = new Map<string, SupportRow[]>();
    for (const s of supports) {
      const list = g.get(s.map_id) ?? [];
      list.push(s);
      g.set(s.map_id, list);
    }
    return g;
  }, [supports]);

  async function resolveSupport(id: string) {
    await supabase.from("support_requests").update({ resolved: true }).eq("id", id);
    refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground"
            aria-label="뒤로"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">팀장 대시보드</h1>
            <p className="text-xs text-muted-foreground">
              지도별 진행 상황 · 실시간
            </p>
          </div>
          {supports.length > 0 && (
            <span className="bg-status-refuse text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              지원요청 {supports.length}
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
          maps.map((m) => {
            const stats = byMap.get(m.id) ?? { total: 0, skip: 0 };
            const denom = Math.max(1, m.total_houses - stats.skip);
            const pct = Math.min(100, Math.round((stats.total / denom) * 100));
            const barColor =
              pct >= 70
                ? "var(--status-done)"
                : pct >= 35
                  ? "var(--status-gift)"
                  : "var(--status-refuse)";
            const reqs = supportByMap.get(m.id) ?? [];
            return (
              <div
                key={m.id}
                className="bg-card border rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base truncate">{m.name}</h2>
                    <div className="text-xs text-muted-foreground">코드 {m.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">{pct}%</div>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>
                    처리 {stats.total}건 / 예상 {m.total_houses}가구
                  </span>
                  <span>대상아님 {stats.skip}건</span>
                </div>

                {reqs.length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    {reqs.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2 bg-status-refuse/10 rounded-lg p-2.5"
                      >
                        <HandHelping className="w-4 h-4 text-status-refuse flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="font-medium truncate">
                            {r.team_name} 지원 요청
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveSupport(r.id)}
                        >
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

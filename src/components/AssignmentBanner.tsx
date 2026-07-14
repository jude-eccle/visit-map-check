import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BellRing, Copy, X, ArrowRight } from "lucide-react";

type PendingAssignment = {
  id: string;
  map_id: string;
  team_name: string;
  map: { code: string; name: string; address: string };
};

export function AssignmentBanner({ teamName }: { teamName: string }) {
  const [pending, setPending] = useState<PendingAssignment | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    if (!teamName) return;
    const { data } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("assignments" as any)
      .select("id, map_id, team_name, maps!inner(code, name, address)")
      .eq("team_name", teamName)
      .eq("status", "pending")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      setPending({
        id: d.id,
        map_id: d.map_id,
        team_name: d.team_name,
        map: d.maps,
      });
    } else {
      setPending(null);
    }
  }

  useEffect(() => {
    load();
    if (!teamName) return;
    const ch = supabase
      .channel(`assign-${teamName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments", filter: `team_name=eq.${teamName}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamName]);

  if (!pending || dismissed === pending.id) return null;

  const address = pending.map.address || "";

  async function copyAddr() {
    if (!address) {
      toast.error("등록된 주소가 없어요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      toast.success("복사됨");
    } catch {
      toast.error("복사 실패");
    }
  }

  async function goNow() {
    if (!pending) return;
    await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("assignments" as any)
      .update({ acknowledged: true })
      .eq("id", pending.id);
    navigate({ to: "/map/$code", params: { code: pending.map.code } });
  }

  return (
    <div className="bg-primary/10 border-2 border-primary rounded-xl p-3 space-y-2 shadow-sm">
      <div className="flex items-start gap-2">
        <BellRing className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-primary font-semibold">팀장님이 다음 지도를 배정했습니다</div>
          <div className="font-bold text-base truncate">
            {pending.map.name} <span className="text-sm font-mono text-muted-foreground">코드 {pending.map.code}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setDismissed(pending.id)}
          className="p-1 -m-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {address ? (
        <div className="bg-white/70 rounded-lg p-2.5 text-base font-medium leading-snug break-words">
          📍 {address}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">주소가 등록되지 않았어요.</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={copyAddr} disabled={!address} className="h-11">
          <Copy className="w-4 h-4 mr-1" /> 📋 주소 복사
        </Button>
        <Button onClick={goNow} className="h-11 font-bold">
          바로 이동 <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

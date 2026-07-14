import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, ShieldCheck, Copy, ArrowRight, Loader2, BellRing, Hourglass } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

type TeamName = { id: string; name: string; order_idx: number };
type PendingAssignment = {
  id: string;
  map_id: string;
  status: "pending" | "acknowledged";
  map: { code: string; name: string; address: string };
};

function Index() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamName[]>([]);
  const [teamName, setTeamName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("teamName") ?? "" : ""
  );
  const [entered, setEntered] = useState(false);
  const [pending, setPending] = useState<PendingAssignment | null>(null);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("team_names" as any)
        .select("id, name, order_idx")
        .order("order_idx");
      setTeams(((data ?? []) as unknown) as TeamName[]);
    })();
  }, []);

  async function loadPending(name: string) {
    if (!name) return;
    setLoadingAssign(true);
    const { data } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("assignments" as any)
      .select("id, map_id, status, maps!inner(code, name, address)")
      .eq("team_name", name)
      .in("status", ["pending", "acknowledged"])
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      setPending({ id: d.id, map_id: d.map_id, status: d.status, map: d.maps });
    } else {
      setPending(null);
    }
    setLoadingAssign(false);
  }

  useEffect(() => {
    if (!entered || !teamName) return;
    loadPending(teamName);
    const ch = supabase
      .channel(`home-assign-${teamName}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
          filter: `team_name=eq.${teamName}`,
        },
        () => loadPending(teamName)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [entered, teamName]);

  function onEnter(e: React.FormEvent) {
    e.preventDefault();
    const t = teamName.trim();
    if (!t) return toast.error("조를 선택해주세요.");
    localStorage.setItem("teamName", t);
    setEntered(true);
  }

  async function copyAddress() {
    const a = pending?.map.address ?? "";
    if (!a) return toast.error("등록된 주소가 없어요.");
    try {
      await navigator.clipboard.writeText(a);
      toast.success("복사됨");
    } catch {
      toast.error("복사 실패");
    }
  }

  async function goToPending() {
    if (!pending) return;
    await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("assignments" as any)
      .update({ status: "acknowledged" })
      .eq("id", pending.id);
    navigate({ to: "/map/$code", params: { code: pending.map.code } });
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeErr(null);
    const c = code.trim();
    if (!/^\d{4}$/.test(c)) return setCodeErr("코드는 4자리 숫자입니다.");
    setCodeBusy(true);
    const { data, error } = await supabase
      .from("maps")
      .select("code")
      .eq("code", c)
      .maybeSingle();
    setCodeBusy(false);
    if (error) return setCodeErr("일시적인 오류가 발생했어요.");
    if (!data) return setCodeErr("등록되지 않은 코드입니다.");
    navigate({ to: "/map/$code", params: { code: c } });
  }

  function changeTeam() {
    setEntered(false);
    setPending(null);
    setShowCodeEntry(false);
    setCode("");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <MapPin className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">전도팀 방문체크</h1>
        </div>

        {!entered ? (
          <form
            onSubmit={onEnter}
            className="bg-card border rounded-2xl p-6 shadow-sm space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="team" className="text-base">
                조 선택
              </Label>
              <Select value={teamName} onValueChange={setTeamName}>
                <SelectTrigger id="team" className="h-14 text-lg">
                  <SelectValue placeholder="조를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.name} className="text-base py-3">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={!teamName}
              className="w-full h-14 text-lg font-semibold"
            >
              입장하기
            </Button>
          </form>
        ) : (
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">현재 조</div>
                <div className="font-bold text-lg">{teamName}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={changeTeam}>
                조 변경
              </Button>
            </div>

            {loadingAssign ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pending ? (
              <div className="bg-primary/10 border-2 border-primary rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <BellRing className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-primary font-semibold">
                      팀장님이 다음 지도를 배정했습니다
                    </div>
                    <div className="font-bold text-base">
                      {pending.map.name}{" "}
                      <span className="text-sm font-mono text-muted-foreground">
                        코드 {pending.map.code}
                      </span>
                    </div>
                  </div>
                </div>
                {pending.map.address ? (
                  <div className="bg-white/70 rounded-lg p-3 text-lg font-medium leading-snug break-words">
                    📍 {pending.map.address}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    주소가 등록되지 않았어요.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={copyAddress}
                    disabled={!pending.map.address}
                    className="h-12"
                  >
                    <Copy className="w-4 h-4 mr-1" /> 📋 주소 복사
                  </Button>
                  <Button onClick={goToPending} className="h-12 font-bold">
                    바로 이동 <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <Hourglass className="w-10 h-10 mx-auto text-muted-foreground opacity-60" />
                <div className="font-semibold">배정 대기 중</div>
                <p className="text-sm text-muted-foreground">
                  팀장님이 지도를 배정하면 여기에 표시됩니다.
                </p>
              </div>
            )}

            <div className="pt-2 border-t">
              {!showCodeEntry ? (
                <button
                  type="button"
                  onClick={() => setShowCodeEntry(true)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  코드를 알고 있다면 직접 입력해서 이동
                </button>
              ) : (
                <form onSubmit={submitCode} className="space-y-2">
                  <Label htmlFor="code" className="text-xs">
                    지도 코드 (4자리) — 비상용
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoComplete="off"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      placeholder="1234"
                      className="h-11 text-lg text-center tracking-widest font-mono"
                      autoFocus
                    />
                    <Button type="submit" disabled={codeBusy || code.length !== 4} className="h-11">
                      이동
                    </Button>
                  </div>
                  {codeErr && (
                    <p className="text-xs text-destructive">{codeErr}</p>
                  )}
                </form>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 text-center space-y-2">
          <a
            href="/leader"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            <ShieldCheck className="w-4 h-4" />
            팀장 화면 — 전체 진행 현황 보기
          </a>
          <div>
            <Link
              to="/admin"
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-4"
            >
              관리자 화면
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

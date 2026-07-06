import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [teamName, setTeamName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("teamName") ?? "" : ""
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onEnter(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const c = code.trim();
    const t = teamName.trim();
    if (!/^\d{4}$/.test(c)) return setErr("지도 코드는 4자리 숫자입니다.");
    if (t.length < 2) return setErr("조 이름을 입력해주세요. (예: 1팀 A조)");
    setLoading(true);
    const { data, error } = await supabase
      .from("maps")
      .select("id, code")
      .eq("code", c)
      .maybeSingle();
    setLoading(false);
    if (error) return setErr("일시적인 오류가 발생했어요. 다시 시도해주세요.");
    if (!data) return setErr("등록되지 않은 코드입니다. 팀장님께 확인해주세요.");
    localStorage.setItem("teamName", t);
    navigate({ to: "/map/$code", params: { code: c } });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <MapPin className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">전도팀 방문체크</h1>
        </div>

        <form
          onSubmit={onEnter}
          className="bg-card border rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="code" className="text-base">
              지도 코드 (4자리)
            </Label>
            <Input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="예: 1234"
              className="h-14 text-2xl text-center tracking-widest font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team" className="text-base">
              조 이름
            </Label>
            <Input
              id="team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="예: 1팀 A조"
              className="h-14 text-lg"
            />
          </div>

          {err && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {err}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-lg font-semibold"
          >
            {loading ? "확인 중…" : "입장하기"}
          </Button>
        </form>

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

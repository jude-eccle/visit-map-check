import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { verifyAdminToken } from "@/lib/admin.functions";
import { getLeaderPhone, setLeaderPhone as setLeaderPhoneFn } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, Image as ImageIcon, ShieldCheck, LayoutDashboard, Square, ArrowUp, ArrowDown, Users } from "lucide-react";
import { getMapImageUrl } from "@/lib/map-image";
import { ZoneEditor } from "@/components/map/ZoneEditor";

type TeamNameRow = { id: string; name: string; order_idx: number };

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type MapRow = {
  id: string;
  code: string;
  name: string;
  image_path: string | null;
  total_houses: number;
  team_memo: string;
  address: string;
};

const TOKEN_KEY = "admin-token-v1";

function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [entry, setEntry] = useState("");
  const [entryLoading, setEntryLoading] = useState(false);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [confirmDel, setConfirmDel] = useState<MapRow | null>(null);
  const [confirmClear, setConfirmClear] = useState<MapRow | null>(null);
  const [editingZones, setEditingZones] = useState<MapRow | null>(null);
  const [leaderPhone, setLeaderPhone] = useState("");
  const [teamNames, setTeamNames] = useState<TeamNameRow[]>([]);
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        try {
          const r = await verifyAdminToken({ data: { token: stored } });
          if (r.ok) setToken(stored);
          else localStorage.removeItem(TOKEN_KEY);
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setChecking(false);
    })();
  }, []);

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    setEntryLoading(true);
    try {
      const r = await verifyAdminToken({ data: { token: entry.trim() } });
      if (r.ok) {
        localStorage.setItem(TOKEN_KEY, entry.trim());
        setToken(entry.trim());
      } else {
        toast.error("관리자 코드가 올바르지 않습니다.");
      }
    } catch {
      toast.error("확인 중 오류가 발생했어요.");
    } finally {
      setEntryLoading(false);
    }
  }

  async function refresh() {
    const { data } = await supabase.from("maps").select("*").order("code");
    const list = (data ?? []) as MapRow[];
    setMaps(list);
    const p: Record<string, string | null> = {};
    await Promise.all(
      list.map(async (m) => {
        p[m.id] = await getMapImageUrl(m.image_path);
      })
    );
    setPreviews(p);
    const s = await getLeaderPhone().catch(() => ({ value: "" }));
    setLeaderPhone(s?.value ?? "");
    const { data: tn } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("team_names" as any)
      .select("id, name, order_idx")
      .order("order_idx");
    setTeamNames(((tn ?? []) as unknown) as TeamNameRow[]);
  }

  async function addTeamName() {
    const name = newTeamName.trim();
    if (!name) return;
    const maxOrder = teamNames.reduce((a, t) => Math.max(a, t.order_idx), 0);
    const { error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("team_names" as any)
      .insert({ name, order_idx: maxOrder + 1 } as never);
    if (error) {
      if (error.code === "23505") toast.error("이미 존재하는 조 이름입니다.");
      else toast.error("추가 실패");
      return;
    }
    setNewTeamName("");
    refresh();
  }

  async function deleteTeamName(id: string) {
    await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("team_names" as any)
      .delete()
      .eq("id", id);
    refresh();
  }

  async function renameTeamName(t: TeamNameRow, v: string) {
    const name = v.trim();
    if (!name || name === t.name) return;
    const { error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("team_names" as any)
      .update({ name })
      .eq("id", t.id);
    if (error) {
      if (error.code === "23505") toast.error("이미 존재하는 조 이름입니다.");
      else toast.error("변경 실패");
    }
    refresh();
  }

  async function moveTeamName(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= teamNames.length) return;
    const a = teamNames[idx];
    const b = teamNames[j];
    await Promise.all([
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("team_names" as any)
        .update({ order_idx: b.order_idx })
        .eq("id", a.id),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("team_names" as any)
        .update({ order_idx: a.order_idx })
        .eq("id", b.id),
    ]);
    refresh();
  }

  async function saveLeaderPhone(v: string) {
    const val = v.trim();
    setLeaderPhone(val);
    const t = token ?? localStorage.getItem(TOKEN_KEY) ?? "";
    try {
      await setLeaderPhoneFn({ data: { token: t, value: val } });
      toast.success("팀장 전화번호가 저장되었어요.");
    } catch {
      toast.error("저장 실패 — 관리자 인증을 다시 확인해주세요.");
    }
  }

  useEffect(() => {
    if (token) refresh();
  }, [token]);


  async function createMap() {
    if (!/^\d{4}$/.test(newCode)) return toast.error("코드는 4자리 숫자입니다.");
    if (newName.trim().length < 1) return toast.error("지도 이름을 입력해주세요.");
    const { error } = await supabase
      .from("maps")
      .insert({ code: newCode, name: newName.trim(), address: newAddress.trim() } as never);
    if (error) {
      if (error.code === "23505") toast.error("이미 사용 중인 코드입니다.");
      else toast.error("생성 실패, 다시 시도해주세요.");
      return;
    }
    setCreating(false);
    setNewCode("");
    setNewName("");
    setNewAddress("");
    toast.success("지도가 추가되었어요.");
    refresh();
  }

  async function uploadImage(m: MapRow, file: File) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${m.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("map-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast.error("업로드 실패");
    if (m.image_path) {
      await supabase.storage.from("map-images").remove([m.image_path]);
    }
    await supabase.from("maps").update({ image_path: path }).eq("id", m.id);
    toast.success("이미지 업데이트 완료");
    refresh();
  }




  async function updateName(m: MapRow, v: string) {
    const name = v.trim();
    if (!name || name === m.name) return;
    await supabase.from("maps").update({ name }).eq("id", m.id);
    refresh();
  }

  async function updateCode(m: MapRow, v: string) {
    const code = v.trim();
    if (code === m.code) return;
    if (!/^\d{4}$/.test(code)) return toast.error("코드는 4자리 숫자입니다.");
    const { error } = await supabase.from("maps").update({ code }).eq("id", m.id);
    if (error) {
      if (error.code === "23505") toast.error("이미 사용 중인 코드입니다.");
      else toast.error("변경 실패");
      refresh();
      return;
    }
    toast.success("코드가 변경되었어요.");
    refresh();
  }


  async function updateAddress(m: MapRow, v: string) {
    const address = v.trim();
    if (address === m.address) return;
    await supabase.from("maps").update({ address } as never).eq("id", m.id);
    refresh();
  }

  async function deleteMap(m: MapRow) {
    setConfirmDel(null);
    if (m.image_path) {
      await supabase.storage.from("map-images").remove([m.image_path]);
    }
    await supabase.from("maps").delete().eq("id", m.id);
    toast.success("삭제되었어요.");
    refresh();
  }

  async function clearData(m: MapRow) {
    setConfirmClear(null);
    await supabase.from("zone_events").delete().eq("map_id", m.id);
    await supabase.from("zone_completions").delete().eq("map_id", m.id);
    await supabase.from("support_requests").delete().eq("map_id", m.id);
    await supabase.from("zones").update({ status: "unvisited" }).eq("map_id", m.id);
    toast.success("이 지도의 카운터·알림을 초기화했어요.");
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setEntry("");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form onSubmit={submitEntry} className="w-full max-w-sm space-y-5">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">관리자 로그인</h1>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tk">관리자 코드</Label>
            <Input
              id="tk"
              type="password"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="h-12"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={entryLoading || entry.length < 4}
            className="w-full h-12"
          >
            {entryLoading ? "확인 중…" : "입장"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            관리자 코드는 앱 설치 시 자동 생성된 값입니다.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto p-3 sm:p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg truncate">관리자 — 지도 관리</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              지도 추가, 이미지 업로드, 구역 설정
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link to="/leader">
                <LayoutDashboard className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">팀장 대시보드</span>
              </Link>
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">새 지도</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3">
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <Label className="text-sm font-semibold">📞 팀장 전화번호 (전체 공통)</Label>
          <p className="text-xs text-muted-foreground">
            팀원 화면의 "팀장님께 전화" 버튼이 이 번호로 전화를 겁니다.
          </p>
          <Input
            type="tel"
            inputMode="tel"
            defaultValue={leaderPhone}
            key={leaderPhone}
            onBlur={(e) => {
              if (e.target.value.trim() !== leaderPhone) saveLeaderPhone(e.target.value);
            }}
            placeholder="예: 010-1234-5678"
            className="h-10"
          />
        </div>

        {maps.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            아직 지도가 없어요. "새 지도"로 추가하세요.
          </p>
        )}
        {maps.map((m) => (
          <div key={m.id} className="bg-card border rounded-xl overflow-hidden">
            <div className="flex gap-3 p-4">
              <div className="w-24 h-24 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                {previews[m.id] ? (
                  <img src={previews[m.id]!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="grid grid-cols-[1fr,90px] gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">지도 이름</Label>
                    <Input
                      defaultValue={m.name}
                      onBlur={(e) => updateName(m, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">코드</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={4}
                      defaultValue={m.code}
                      onBlur={(e) =>
                        updateCode(m, e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 pb-3 space-y-1">
              <Label className="text-xs">지역 주소 (팀원에게 안내됨)</Label>
              <Input
                defaultValue={m.address}
                onBlur={(e) => updateAddress(m, e.target.value)}
                placeholder="예: 강원 삼척시 근덕면 궁촌리 123-4"
                className="h-9 text-sm"
              />
            </div>
            <div className="px-4 pb-3 space-y-1" />

            <div className="border-t px-3 py-2 flex flex-wrap gap-2 bg-muted/40">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(m, f);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex items-center h-9 px-3 text-sm rounded-md border bg-card hover:bg-accent cursor-pointer">
                  <Upload className="w-4 h-4 mr-1" /> 이미지 업로드
                </span>
              </label>
              <Button variant="outline" size="sm" onClick={() => setEditingZones(m)}>
                <Square className="w-4 h-4 mr-1" /> 구역 설정
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmClear(m)}>
                기록 초기화
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive ml-auto"
                onClick={() => setConfirmDel(m)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> 지도 삭제
              </Button>
            </div>
          </div>
        ))}
      </main>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>새 지도 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>지도 이름</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 삼척 근덕면"
              />
            </div>
            <div className="space-y-1">
              <Label>지역 주소 (선택)</Label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="예: 강원 삼척시 근덕면 궁촌리 123-4"
              />
            </div>
            <div className="space-y-1">
              <Label>코드 (4자리 숫자)</Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>
              취소
            </Button>
            <Button onClick={createMap}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>지도를 삭제할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            이 지도의 모든 핀과 지원 요청이 함께 삭제됩니다.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => confirmDel && deleteMap(confirmDel)}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmClear} onOpenChange={(o) => !o && setConfirmClear(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>이 지도의 방문 기록을 초기화할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            이 지도의 모든 방문 기록(구역 상태·카운터·완료 알림·지원 요청)이 삭제됩니다. 계속하시겠습니까?
          </p>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmClear(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmClear && clearData(confirmClear)}
            >
              초기화
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingZones && (
        <ZoneEditor
          mapId={editingZones.id}
          mapImagePath={editingZones.image_path}
          mapName={editingZones.name}
          open={!!editingZones}
          onOpenChange={(o) => !o && setEditingZones(null)}
        />
      )}
    </div>
  );
}

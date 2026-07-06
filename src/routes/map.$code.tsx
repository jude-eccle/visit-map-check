import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_META, type PinStatus } from "@/lib/status";
import { StatusSheet } from "@/components/map/StatusSheet";
import { Pin } from "@/components/map/Pin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Minus,
  Maximize,
  HandHelping,
  Home,
  ArrowLeft,
  Trash2,
  WifiOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { enqueue, flushQueue, queueSize, subscribe as subQueue } from "@/lib/offline-queue";
import { getMapImageUrl } from "@/lib/map-image";

export const Route = createFileRoute("/map/$code")({
  component: MapPage,
});

type PinRow = {
  id: string;
  map_id: string;
  x_pct: number;
  y_pct: number;
  status: PinStatus;
  team_name: string;
  created_at: string;
};

type MapRow = {
  id: string;
  code: string;
  name: string;
  image_path: string | null;
  total_houses: number;
};

function MapPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [teamName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("teamName") ?? "" : ""
  );
  const [map, setMap] = useState<MapRow | null>(null);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PinRow | null>(null);
  const [housesDialogOpen, setHousesDialogOpen] = useState(false);
  const [houseInput, setHouseInput] = useState("");
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wasDraggingRef = useRef(false);

  // 초기 로드
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
      const url = await getMapImageUrl(m.image_path);
      setImageUrl(url);
      const { data: ps } = await supabase
        .from("pins")
        .select("*")
        .eq("map_id", m.id)
        .order("created_at", { ascending: true });
      setPins((ps ?? []) as PinRow[]);
      setLoading(false);
    })();
  }, [code, teamName, navigate]);

  // Realtime
  useEffect(() => {
    if (!map) return;
    const channel = supabase
      .channel(`pins-${map.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pins", filter: `map_id=eq.${map.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPins((prev) => {
              const row = payload.new as PinRow;
              if (prev.some((p) => p.id === row.id)) return prev;
              return [...prev, row];
            });
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id: string };
            setPins((prev) => prev.filter((p) => p.id !== oldRow.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "maps", filter: `id=eq.${map.id}` },
        (payload) => setMap(payload.new as MapRow)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [map]);

  // 오프라인 상태 & 큐 크기
  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    const refreshQ = async () => setQueued(await queueSize());
    refreshQ();
    const unsub = subQueue(refreshQ);
    return () => {
      window.removeEventListener("online", upd);
      window.removeEventListener("offline", upd);
      unsub();
    };
  }, []);

  const progress = useMemo(() => {
    if (!map) return { pct: 0, done: 0, denom: 0, skip: 0 };
    const skip = pins.filter((p) => p.status === "skip").length;
    const denom = Math.max(1, map.total_houses - skip);
    const done = pins.length;
    const pct = Math.min(100, Math.round((done / denom) * 100));
    return { pct, done, denom, skip };
  }, [pins, map]);

  function handleImageTap(e: React.MouseEvent<HTMLDivElement>) {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    setPendingPos({ x, y });
    setSheetOpen(true);
  }

  async function commitPin(status: PinStatus) {
    if (!map || !pendingPos) return;
    setSheetOpen(false);
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    const optimistic: PinRow = {
      id: tempId,
      map_id: map.id,
      x_pct: pendingPos.x,
      y_pct: pendingPos.y,
      status,
      team_name: teamName,
      created_at: now,
    };
    setPins((prev) => [...prev, optimistic]);
    const pos = pendingPos;
    setPendingPos(null);

    let undone = false;
    const undo = () => {
      undone = true;
      setPins((prev) => prev.filter((p) => p.id !== tempId));
    };

    toast(`${STATUS_META[status].label} 저장됨`, {
      duration: 5000,
      action: { label: "되돌리기", onClick: undo },
    });

    // 저장 시도
    const trySave = async (attempt = 0): Promise<void> => {
      if (undone) return;
      try {
        const { data, error } = await supabase
          .from("pins")
          .insert({
            map_id: map.id,
            x_pct: pos.x,
            y_pct: pos.y,
            status,
            team_name: teamName,
          })
          .select("*")
          .single();
        if (error) throw error;
        if (undone) {
          // 되돌렸으면 서버에서도 삭제
          await supabase.from("pins").delete().eq("id", data.id);
          return;
        }
        setPins((prev) => prev.map((p) => (p.id === tempId ? (data as PinRow) : p)));
      } catch (e) {
        if (attempt < 2 && navigator.onLine) {
          setTimeout(() => trySave(attempt + 1), 800);
          return;
        }
        // 오프라인 큐로
        await enqueue({
          kind: "insert",
          tempId,
          map_id: map.id,
          x_pct: pos.x,
          y_pct: pos.y,
          status,
          team_name: teamName,
          created_at: now,
        });
        toast.warning("오프라인 저장됨 — 연결되면 자동 동기화됩니다.");
      }
    };
    trySave();
  }

  async function deletePin(pin: PinRow) {
    setConfirmDelete(null);
    setSelectedPin(null);
    setPins((prev) => prev.filter((p) => p.id !== pin.id));
    if (pin.id.startsWith("tmp-")) return;
    const trySave = async (attempt = 0): Promise<void> => {
      try {
        const { error } = await supabase.from("pins").delete().eq("id", pin.id);
        if (error) throw error;
      } catch (e) {
        if (attempt < 2 && navigator.onLine) {
          setTimeout(() => trySave(attempt + 1), 800);
          return;
        }
        await enqueue({ kind: "delete", id: pin.id });
        toast.warning("삭제 대기 중 — 연결되면 자동 처리됩니다.");
      }
    };
    trySave();
  }

  async function requestSupport() {
    if (!map) return;
    const { error } = await supabase
      .from("support_requests")
      .insert({ map_id: map.id, team_name: teamName });
    if (error) {
      toast.error("지원 요청 실패, 다시 시도해주세요.");
      return;
    }
    toast.success("지원 요청을 팀장님께 전달했어요.");
  }

  async function saveHouses() {
    if (!map) return;
    const n = parseInt(houseInput, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("숫자를 입력해주세요.");
      return;
    }
    const { error } = await supabase
      .from("maps")
      .update({ total_houses: n })
      .eq("id", map.id);
    if (error) return toast.error("저장 실패, 다시 시도해주세요.");
    setMap({ ...map, total_houses: n });
    setHousesDialogOpen(false);
    toast.success(`가구수를 ${n}(으)로 변경했어요.`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!map) return null;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* 상단 헤더 */}
      <header className="flex-shrink-0 bg-card border-b px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base truncate">{map.name}</h1>
              <span className="text-xs text-muted-foreground">코드 {map.code}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{teamName}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {!online && (
              <span className="text-xs flex items-center gap-1 text-status-refuse">
                <WifiOff className="w-3.5 h-3.5" /> 오프라인
              </span>
            )}
            {queued > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                저장 대기 {queued}건
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progress.pct} className="h-2.5 flex-1" />
          <span className="text-sm font-semibold tabular-nums w-14 text-right">
            {progress.pct}%
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>
            처리 {progress.done}건 / 예상 {map.total_houses}가구
          </span>
          <span>대상아님 {progress.skip}건</span>
        </div>
      </header>

      {/* 지도 영역 */}
      <div className="relative flex-1 overflow-hidden bg-muted">
        <TransformWrapper
          ref={transformRef}
          minScale={1}
          maxScale={8}
          initialScale={1}
          doubleClick={{ disabled: true }}
          onTransform={(ref) => setScale(ref.state.scale)}
          onPanning={() => (wasDraggingRef.current = true)}
          panning={{ velocityDisabled: true }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: "100%", height: "100%" }}
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              onClick={handleImageTap}
            >
              {imageUrl ? (
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt={map.name}
                  className="max-w-full max-h-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div
                  ref={imgRef as any}
                  className="w-full max-w-2xl aspect-[4/3] bg-white border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm p-6 text-center"
                >
                  지도 이미지가 아직 업로드되지 않았어요.
                  <br />
                  탭하여 위치는 계속 기록할 수 있어요.
                </div>
              )}
              {/* 핀 오버레이 */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className="relative"
                  style={{
                    width: imgRef.current?.getBoundingClientRect().width || "100%",
                    height: imgRef.current?.getBoundingClientRect().height || "100%",
                  }}
                >
                  {pins.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (wasDraggingRef.current) {
                          wasDraggingRef.current = false;
                          return;
                        }
                        setSelectedPin(p);
                      }}
                      className="absolute pointer-events-auto"
                      style={{
                        left: `${p.x_pct}%`,
                        top: `${p.y_pct}%`,
                        transform: `translate(-50%, -100%) scale(${1 / scale})`,
                        transformOrigin: "bottom center",
                      }}
                      aria-label={STATUS_META[p.status].label}
                    >
                      <Pin status={p.status} size={22} outline />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TransformComponent>
        </TransformWrapper>

        {/* 줌 컨트롤 */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <Button
            size="icon"
            variant="secondary"
            className="w-11 h-11 shadow"
            onClick={() => transformRef.current?.zoomIn(0.4)}
          >
            <Plus className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="w-11 h-11 shadow"
            onClick={() => transformRef.current?.zoomOut(0.4)}
          >
            <Minus className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="w-11 h-11 shadow"
            onClick={() => transformRef.current?.resetTransform()}
          >
            <Maximize className="w-5 h-5" />
          </Button>
          <div className="text-[10px] text-center bg-card/90 backdrop-blur px-1.5 py-0.5 rounded shadow">
            {Math.round(scale * 100)}%
          </div>
        </div>
      </div>

      {/* 하단 액션 */}
      <footer className="flex-shrink-0 bg-card border-t p-2 grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="h-12 text-sm"
          onClick={requestSupport}
        >
          <HandHelping className="w-4 h-4 mr-1" />
          지원 요청
        </Button>
        <Button
          variant="outline"
          className="h-12 text-sm"
          onClick={() => {
            setHouseInput(String(map.total_houses));
            setHousesDialogOpen(true);
          }}
        >
          <Home className="w-4 h-4 mr-1" />
          가구수 {map.total_houses}
        </Button>
        <Button
          variant="outline"
          className="h-12 text-sm"
          onClick={() => navigate({ to: "/" })}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          다른 지도
        </Button>
      </footer>

      <StatusSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setPendingPos(null);
        }}
        onPick={commitPin}
      />

      {/* 기존 핀 정보 */}
      <Dialog open={!!selectedPin} onOpenChange={(o) => !o && setSelectedPin(null)}>
        <DialogContent className="sm:max-w-sm">
          {selectedPin && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: STATUS_META[selectedPin.status].color }}
                  />
                  <DialogTitle>{STATUS_META[selectedPin.status].label}</DialogTitle>
                </div>
                <DialogDescription className="pt-1">
                  {selectedPin.team_name} · {formatTime(selectedPin.created_at)}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                잘못 체크되었다면 삭제할 수 있습니다. 맞다면 다른 위치를 탭해 계속
                진행하세요.
              </p>
              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDelete(selectedPin)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />이 표시 삭제하기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>이 표시를 삭제할까요?</DialogTitle>
            <DialogDescription>삭제 후 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deletePin(confirmDelete)}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={housesDialogOpen} onOpenChange={setHousesDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>예상 가구수 수정</DialogTitle>
            <DialogDescription>
              현장에서 실제 가구수가 다르면 조정할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={houseInput}
            onChange={(e) => setHouseInput(e.target.value.replace(/\D/g, ""))}
            className="h-12 text-lg text-center"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setHousesDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={saveHouses}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

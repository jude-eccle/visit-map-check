import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  ZONE_STATUS_META,
  type Category,
  type ZoneStatus,
} from "@/lib/zones";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Handshake,
  Camera,
  X,
} from "lucide-react";
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
};

type ZoneRow = {
  id: string;
  map_id: string;
  name: string;
  status: ZoneStatus;
  order_idx: number;
  landmark: string | null;
};

type EventRow = {
  id: string;
  zone_id: string;
  map_id: string;
  team_name: string;
  category: Category;
  created_at: string;
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

type ActivityRow = {
  id: string;
  zone_id: string;
  map_id: string;
  team_name: string;
  started_at: string;
  ended_at: string | null;
};

type DialogMode = { zone: ZoneRow; kind: "complete" | "handoff" } | null;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(diffMs / 60000));
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function MapPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [teamName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("teamName") ?? "" : ""
  );
  const [map, setMap] = useState<MapRow | null>(null);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [leaderPhone, setLeaderPhone] = useState("");
  const [confirmRevertZone, setConfirmRevertZone] = useState<ZoneRow | null>(null);
  const [abandonedChoice, setAbandonedChoice] = useState<ZoneRow | null>(null);
  const [confirmResetUnvisited, setConfirmResetUnvisited] = useState<ZoneRow | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [noteDialog, setNoteDialog] = useState<DialogMode>(null);
  const [noteText, setNoteText] = useState("");
  const [notePhoto, setNotePhoto] = useState<File | null>(null);
  const [notePhotoPreview, setNotePhotoPreview] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [postSaveOpen, setPostSaveOpen] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [handoffsModal, setHandoffsModal] = useState<{ zoneId: string; zoneName: string } | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [decisionPrompt, setDecisionPrompt] = useState<{ eventId: string; finish: (v: boolean | null) => void } | null>(null);
  const decisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      if (!teamName) {
        navigate({ to: "/" });
        return;
      }
      setLoading(true);
      const { data: m } = await supabase
        .from("maps")
        .select("id, code, name, image_path")
        .eq("code", code)
        .maybeSingle();
      if (!m) {
        setLoading(false);
        throw notFound();
      }
      setMap(m as MapRow);
      setImageUrl(await getMapImageUrl(m.image_path));
      const [{ data: zs }, { data: es }, hRes, aRes, ph] = await Promise.all([
        supabase.from("zones").select("id, map_id, name, status, order_idx, landmark").eq("map_id", m.id).order("order_idx"),
        supabase.from("zone_events").select("*").eq("map_id", m.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("handoffs" as any).select("*").eq("map_id", m.id).order("created_at", { ascending: false })) as unknown as Promise<{ data: HandoffRow[] | null }>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("zone_activity" as any).select("*").eq("map_id", m.id)) as unknown as Promise<{ data: ActivityRow[] | null }>,
        getLeaderPhone().catch(() => ({ value: "" })),
      ]);
      setZones((zs ?? []) as ZoneRow[]);
      setEvents((es ?? []) as EventRow[]);
      setHandoffs((hRes.data ?? []) as HandoffRow[]);
      setActivity((aRes.data ?? []) as ActivityRow[]);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "handoffs", filter: `map_id=eq.${map.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setHandoffs((p) => {
              const r = payload.new as HandoffRow;
              if (p.some((x) => x.id === r.id)) return p;
              return [r, ...p];
            });
          } else if (payload.eventType === "DELETE") {
            const r = payload.old as { id: string };
            setHandoffs((p) => p.filter((x) => x.id !== r.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zone_activity", filter: `map_id=eq.${map.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const r = payload.new as ActivityRow;
            setActivity((p) => (p.some((x) => x.id === r.id) ? p : [...p, r]));
          } else if (payload.eventType === "UPDATE") {
            const r = payload.new as ActivityRow;
            setActivity((p) => {
              const rest = p.filter((x) => x.id !== r.id);
              return [...rest, r];
            });
          } else if (payload.eventType === "DELETE") {
            const r = payload.old as { id: string };
            setActivity((p) => p.filter((x) => x.id !== r.id));
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

  const latestHandoffByZone = useMemo(() => {
    const m = new Map<string, HandoffRow>();
    for (const h of handoffs) {
      const prev = m.get(h.zone_id);
      if (!prev || new Date(h.created_at) > new Date(prev.created_at)) m.set(h.zone_id, h);
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


  // zone_id -> list of team names currently active in that zone
  const teamsInZone = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of activity) {
      if (a.ended_at) continue;
      const arr = m.get(a.zone_id) ?? [];
      if (!arr.includes(a.team_name)) arr.push(a.team_name);
      m.set(a.zone_id, arr);
    }
    return m;
  }, [activity]);

  // Does the current team have an open activity row for this zone?
  const myActivityByZone = useMemo(() => {
    const m = new Map<string, ActivityRow>();
    for (const a of activity) {
      if (a.ended_at || a.team_name !== teamName) continue;
      m.set(a.zone_id, a);
    }
    return m;
  }, [activity, teamName]);

  // Most recent ended activity per zone (used for "abandoned" info)
  const lastEndedByZone = useMemo(() => {
    const m = new Map<string, ActivityRow>();
    for (const a of activity) {
      if (!a.ended_at) continue;
      const prev = m.get(a.zone_id);
      if (!prev || new Date(a.ended_at) > new Date(prev.ended_at!)) m.set(a.zone_id, a);
    }
    return m;
  }, [activity]);

  // Effective display status per zone
  function displayStatus(z: ZoneRow): ZoneStatus {
    if (z.status === "done") return "done";
    if ((teamsInZone.get(z.id)?.length ?? 0) > 0) return "in_progress";
    if (lastEndedByZone.has(z.id)) return "abandoned";
    return "unvisited";
  }

  // Resolve signed URLs for handoff photo thumbnails
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

  // Auto-select the zone THIS team is currently active in
  useEffect(() => {
    if (selectedZoneId && myActivityByZone.has(selectedZoneId)) return;
    const firstMine = zones.find((z) => myActivityByZone.has(z.id) && z.status !== "done");
    setSelectedZoneId(firstMine?.id ?? null);
  }, [zones, selectedZoneId, myActivityByZone]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selStats = selectedZone
    ? zoneStats.get(selectedZone.id) ?? { total: 0, by: { done: 0, gift: 0, away: 0, other: 0 } }
    : null;

  // Tap = per-team 2-state toggle: unvisited <-> in_progress (never done).
  // Only "이 구역 완료" button can set done.
  async function cycleZone(z: ZoneRow) {
    if (z.status === "done") {
      setConfirmRevertZone(z);
      return;
    }
    // Abandoned zone with no active team → ask user whether to resume or reset
    if (displayStatus(z) === "abandoned" && !myActivityByZone.get(z.id)) {
      setAbandonedChoice(z);
      return;
    }
    const mine = myActivityByZone.get(z.id);
    if (mine) {
      // Close my activity for this zone
      setActivity((p) => p.filter((x) => x.id !== mine.id));
      if (selectedZoneId === z.id) setSelectedZoneId(null);
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("zone_activity" as any)
        .update({ ended_at: new Date().toISOString() } as never)
        .eq("id", mine.id);
      if (error) {
        toast.error("상태 변경 실패");
        setActivity((p) => [...p, mine]);
        return;
      }
      toast(`${z.name} 방문 종료`);
    } else {
      // Start my activity for this zone
      const tempId = `tmp-${Date.now()}`;
      const optimistic: ActivityRow = {
        id: tempId,
        zone_id: z.id,
        map_id: z.map_id,
        team_name: teamName,
        started_at: new Date().toISOString(),
        ended_at: null,
      };
      setActivity((p) => [...p, optimistic]);
      setSelectedZoneId(z.id);
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("zone_activity" as any)
        .insert({ zone_id: z.id, map_id: z.map_id, team_name: teamName } as never)
        .select("*")
        .single();
      if (error || !data) {
        toast.error("상태 변경 실패");
        setActivity((p) => p.filter((x) => x.id !== tempId));
        return;
      }
      setActivity((p) => p.map((x) => (x.id === tempId ? ((data as unknown) as ActivityRow) : x)));
      toast(`${z.name} 방문중`);
    }
  }

  function openNoteDialog(zone: ZoneRow, kind: "complete" | "handoff") {
    setNoteText("");
    setNotePhoto(null);
    setNotePhotoPreview(null);
    setNoteDialog({ zone, kind });
  }

  function closeNoteDialog() {
    setNoteDialog(null);
    setNoteText("");
    setNotePhoto(null);
    if (notePhotoPreview) URL.revokeObjectURL(notePhotoPreview);
    setNotePhotoPreview(null);
  }

  function selectPhoto(file: File | null) {
    if (notePhotoPreview) URL.revokeObjectURL(notePhotoPreview);
    setNotePhoto(file);
    setNotePhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function uploadPhoto(mapId: string, zoneId: string, file: File): Promise<string | null> {
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunk)),
        );
      }
      const fileBase64 = btoa(binary);
      const { uploadHandoffPhoto } = await import("@/lib/handoff.functions");
      const res = await uploadHandoffPhoto({
        data: {
          mapId,
          zoneId,
          fileBase64,
          contentType: file.type || "image/jpeg",
          ext,
        },
      });
      return res.path;
    } catch {
      toast.error("사진 업로드 실패");
      return null;
    }
  }

  async function submitNoteDialog() {
    if (!noteDialog || !map) return;
    const { zone, kind } = noteDialog;
    setSavingNote(true);
    try {
      let photoPath: string | null = null;
      if (notePhoto) {
        photoPath = await uploadPhoto(map.id, zone.id, notePhoto);
        if (!photoPath) {
          setSavingNote(false);
          return;
        }
      }

      // Insert handoff record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("handoffs" as any) as any).insert({
        map_id: map.id,
        zone_id: zone.id,
        team_name: teamName,
        kind,
        note: noteText.trim(),
        photo_url: photoPath,
      });

      if (kind === "complete") {
        // Set zone status done + upsert completion
        setZones((p) => p.map((x) => (x.id === zone.id ? { ...x, status: "done" } : x)));
        const { error } = await supabase.from("zones").update({ status: "done" }).eq("id", zone.id);
        if (error) {
          toast.error("완료 처리 실패");
          setZones((p) => p.map((x) => (x.id === zone.id ? { ...x, status: zone.status } : x)));
          setSavingNote(false);
          return;
        }
        // Close all active zone_activity rows for this zone (all teams)
        const nowIso = new Date().toISOString();
        await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("zone_activity" as any)
          .update({ ended_at: nowIso } as never)
          .eq("zone_id", zone.id)
          .is("ended_at", null);
        setActivity((p) => p.map((x) => (x.zone_id === zone.id && !x.ended_at ? { ...x, ended_at: nowIso } : x)));
        const stats = zoneStats.get(zone.id) ?? { total: 0, by: { done: 0, gift: 0, away: 0, other: 0 } };
        await supabase.from("zone_completions").upsert(
          {
            zone_id: zone.id,
            map_id: zone.map_id,
            team_name: teamName,
            counters: { total: stats.total, ...stats.by },
            acknowledged: false,
            created_at: new Date().toISOString(),
          },
          { onConflict: "zone_id,team_name" }
        );
        toast.success(`${zone.name} 완료 (${teamName}) — 팀장에게 알림 전송`);
        closeNoteDialog();
        setPostSaveOpen(true);
        return;
      } else {
        // Handoff: close my own open activity for this zone
        const nowIso = new Date().toISOString();
        const mine = myActivityByZone.get(zone.id);
        if (mine) {
          await supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from("zone_activity" as any)
            .update({ ended_at: nowIso } as never)
            .eq("id", mine.id);
          setActivity((p) => p.map((x) => (x.id === mine.id ? { ...x, ended_at: nowIso } : x)));
        }
        toast.success(`${zone.name} 교대 인계 기록됨`);
        closeNoteDialog();
        setPostSaveOpen(true);
        return;
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function revertZoneToInProgress(z: ZoneRow) {
    setConfirmRevertZone(null);
    // Set zone back to unvisited; the team can tap again to open a fresh activity row
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: "unvisited" } : x)));
    const { error } = await supabase.from("zones").update({ status: "unvisited" }).eq("id", z.id);
    if (error) {
      toast.error("되돌리기 실패");
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: "done" } : x)));
      return;
    }
    // Re-open activity for this team so the counters footer becomes available
    const { data } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("zone_activity" as any)
      .insert({ zone_id: z.id, map_id: z.map_id, team_name: teamName } as never)
      .select("*")
      .single();
    if (data) {
      setActivity((p) => [...p, (data as unknown) as ActivityRow]);
      setSelectedZoneId(z.id);
    }
    await supabase.from("zone_completions").delete().eq("zone_id", z.id).eq("team_name", teamName);
  }

  async function resetZoneToUnvisited(z: ZoneRow) {
    setConfirmResetUnvisited(null);
    setAbandonedChoice(null);
    const prevActivity = activity.filter((a) => a.zone_id === z.id);
    const prevStatus = z.status;
    // Optimistic
    setActivity((p) => p.filter((a) => a.zone_id !== z.id));
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: "unvisited" } : x)));
    if (selectedZoneId === z.id) setSelectedZoneId(null);
    const { error: delErr } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("zone_activity" as any)
      .delete()
      .eq("zone_id", z.id);
    if (delErr) {
      toast.error("초기화 실패");
      setActivity((p) => [...p, ...prevActivity]);
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: prevStatus } : x)));
      return;
    }
    if (prevStatus !== "unvisited") {
      const { error: upErr } = await supabase
        .from("zones")
        .update({ status: "unvisited" })
        .eq("id", z.id);
      if (upErr) {
        toast.error("초기화 실패");
        setZones((p) => p.map((x) => (x.id === z.id ? { ...x, status: prevStatus } : x)));
        return;
      }
    }
    toast.success(`${z.name} 미방문 상태로 초기화됨`);
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
    const showSaveToast = () => {
      toast(`+1 ${CATEGORY_META[cat].label}`, {
        duration: 30000,
        action: { label: "되돌리기", onClick: undo },
      });
    };
    if (cat !== "done") showSaveToast();
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
    if (cat === "done" && !undone) {
      if (decisionTimerRef.current) clearTimeout(decisionTimerRef.current);
      const eventId = data.id;
      const finish = (value: boolean | null) => {
        if (decisionTimerRef.current) clearTimeout(decisionTimerRef.current);
        setDecisionPrompt(null);
        if (value !== null) {
          void supabase.from("zone_events").update({ decided: value } as never).eq("id", eventId);
        }
        showSaveToast();
      };
      setDecisionPrompt({ eventId, finish });
    }
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

  const selHandoff = selectedZone ? latestHandoffByZone.get(selectedZone.id) : null;
  const selHandoffThumb = selHandoff?.photo_url ? thumbUrls[selHandoff.photo_url] : null;

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

      <div className="bg-muted flex items-center justify-center p-2">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={map.name}
            className="block max-w-full h-auto select-none"
            draggable={false}
          />
        ) : (
          <div className="w-[90vw] max-w-2xl aspect-[4/3] bg-white border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
            지도 이미지가 업로드되지 않았어요.
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        {zones.length === 0 ? (
          <div className="bg-card border rounded-lg p-4 text-sm text-center text-muted-foreground">
            아직 이 지도에 구역이 설정되지 않았어요. 관리자 화면에서 구역을 등록해주세요.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {zones.map((z) => {
              const ds = displayStatus(z);
              const meta = ZONE_STATUS_META[ds];
              const isSel = z.id === selectedZoneId;
              const st = zoneStats.get(z.id);
              const h = latestHandoffByZone.get(z.id);
              const thumb = h?.photo_url ? thumbUrls[h.photo_url] : null;
              const teams = teamsInZone.get(z.id) ?? [];
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => cycleZone(z)}
                  className="rounded-lg p-2 flex flex-col items-center justify-center text-center min-h-[64px] active:scale-[0.98] transition"
                  style={{
                    backgroundColor: meta.fill,
                    border: `${isSel ? 3 : 2}px solid ${meta.color}`,
                    color: meta.color,
                  }}
                >
                  <span className="font-bold text-base leading-tight">{z.name}</span>
                  {z.landmark && (
                    <span className="text-[10px] leading-tight opacity-90 line-clamp-2 px-0.5">
                      {z.landmark}
                    </span>
                  )}
                  <span className="text-[10px] leading-tight">{meta.label}</span>
                  {ds === "in_progress" && teams.length > 0 && (
                    <span className="text-[10px] leading-tight font-medium">
                      {teams.join(", ")}
                    </span>
                  )}
                  {ds === "abandoned" && (() => {
                    const last = lastEndedByZone.get(z.id);
                    if (!last) return null;
                    return (
                      <span className="text-[10px] leading-tight font-medium">
                        마지막 {last.team_name}, {timeAgo(last.ended_at!)}
                      </span>
                    );
                  })()}
                  {st && st.total > 0 && (
                    <span className="text-[10px] tabular-nums opacity-80">시도 {st.total}</span>
                  )}
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      className="mt-1 w-8 h-8 object-cover rounded border border-white/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoModal(thumb);
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="flex-shrink-0 bg-card border-t sticky bottom-0 mt-auto">
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
            {(() => {
              const recCount = handoffsByZone.get(selectedZone.id)?.length ?? 0;
              if (recCount === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() =>
                    setHandoffsModal({ zoneId: selectedZone.id, zoneName: selectedZone.name })
                  }
                  className="flex items-center gap-2 text-xs text-muted-foreground px-1 hover:text-foreground transition"
                >
                  {selHandoffThumb ? (
                    <img src={selHandoffThumb} alt="" className="w-10 h-10 object-cover rounded border" />
                  ) : (
                    <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-[9px]">
                      기록
                    </div>
                  )}
                  <span className="truncate">전체 기록 보기 ({recCount})</span>
                </button>
              );
            })()}
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
            {decisionPrompt && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
                onClick={() => decisionPrompt.finish(null)}
              >
                <div
                  className="w-full max-w-xs rounded-2xl bg-card shadow-2xl p-5 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center text-base font-semibold">결신하셨나요?</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => decisionPrompt.finish(true)}
                      className="h-12 rounded-lg bg-status-done text-white text-base font-bold active:scale-[0.98] transition"
                    >
                      예
                    </button>
                    <button
                      type="button"
                      onClick={() => decisionPrompt.finish(false)}
                      className="h-12 rounded-lg border-2 bg-card text-base font-bold active:scale-[0.98] transition"
                    >
                      아니오
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => decisionPrompt.finish(null)}
                    className="w-full h-10 text-sm text-muted-foreground"
                  >
                    건너뛰기
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => openNoteDialog(selectedZone, "handoff")}
                variant="outline"
                className="h-12 text-sm font-semibold"
              >
                <Handshake className="w-4 h-4 mr-1" /> 교대 인계
              </Button>
              <Button
                onClick={() => openNoteDialog(selectedZone, "complete")}
                className="h-12 text-base font-bold"
                style={{ backgroundColor: "#0F6E56", color: "white" }}
              >
                <CheckCircle2 className="w-5 h-5 mr-1" /> 이 구역 완료
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {zones.some((z) => myActivityByZone.has(z.id))
              ? "위에서 방문중인 구역을 눌러 선택하세요."
              : "구역을 탭해 '방문중'으로 표시하면 카운터가 열립니다."}
          </div>
        )}
        <div className="border-t p-2 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 text-sm" onClick={callLeader}>
            <Phone className="w-4 h-4 mr-1" /> 📞 팀장님께 전화
          </Button>
          <Button variant="outline" className="h-11 text-sm" onClick={handleLeaveMap}>
            <ArrowLeft className="w-4 h-4 mr-1" /> 나가기
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

      <Dialog open={!!abandonedChoice} onOpenChange={(o) => !o && setAbandonedChoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>"{abandonedChoice?.name}" 구역을 어떻게 할까요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            이 구역은 이전에 방문했지만 완료되지 않은 상태입니다.
          </p>
          <div className="grid gap-2 pt-1">
            <Button
              className="h-12 text-base font-semibold"
              style={{ backgroundColor: ZONE_STATUS_META.in_progress.color, color: "white" }}
              onClick={() => {
                const z = abandonedChoice;
                setAbandonedChoice(null);
                if (z) cycleZone({ ...z, status: "unvisited" });
              }}
            >
              이어서 방문중으로
            </Button>
            <Button
              variant="outline"
              className="h-12 text-base font-semibold"
              onClick={() => {
                if (abandonedChoice) setConfirmResetUnvisited(abandonedChoice);
              }}
            >
              미방문으로 초기화
            </Button>
            <Button variant="ghost" onClick={() => setAbandonedChoice(null)}>
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmResetUnvisited} onOpenChange={(o) => !o && setConfirmResetUnvisited(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>미방문 상태로 되돌릴까요?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{confirmResetUnvisited?.name}" 구역을 미방문 상태로 되돌릴까요?
            <br />
            (실수로 누른 경우에만 사용하세요. 완료·인계 기록과 카운터는 그대로 유지됩니다.)
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmResetUnvisited(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmResetUnvisited && resetZoneToUnvisited(confirmResetUnvisited)}
            >
              미방문으로 초기화
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

      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && closeNoteDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.kind === "complete" ? "이 구역 완료 기록" : "교대 인계 기록"}
              {noteDialog && <span className="ml-1 text-sm text-muted-foreground">— {noteDialog.zone.name}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="메모 (선택) — 다음 조가 참고할 내용, 주의사항 등"
              className="min-h-[80px] text-sm"
            />
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  selectPhoto(f ?? null);
                  e.target.value = "";
                }}
              />
              {notePhotoPreview ? (
                <div className="space-y-2">
                  <div className="relative inline-block">
                    <img src={notePhotoPreview} alt="" className="w-32 h-32 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => selectPhoto(null)}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                      aria-label="사진 삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-1" /> 다시 찍기
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-1" /> 사진 첨부 (선택)
                </Button>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeNoteDialog} disabled={savingNote}>
              취소
            </Button>
            <Button onClick={() => setConfirmSaveOpen(true)} disabled={savingNote}>
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-save confirmation */}
      <Dialog open={confirmSaveOpen} onOpenChange={(o) => !savingNote && setConfirmSaveOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>이 내용으로 저장하시겠습니까?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {notePhotoPreview && (
              <img src={notePhotoPreview} alt="" className="w-full max-h-48 object-contain rounded border bg-muted" />
            )}
            <div className="text-sm whitespace-pre-wrap rounded border p-2 bg-muted/40 min-h-[3rem]">
              {noteText.trim() || <span className="text-muted-foreground">(메모 없음)</span>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSaveOpen(false)} disabled={savingNote}>
              아니오, 다시 확인
            </Button>
            <Button
              onClick={async () => {
                setConfirmSaveOpen(false);
                await submitNoteDialog();
              }}
              disabled={savingNote}
            >
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "예, 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-save exit prompt */}
      <Dialog open={postSaveOpen} onOpenChange={setPostSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>저장되었습니다. 나가시겠습니까?</DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPostSaveOpen(false)}>
              아니오, 여기 남기
            </Button>
            <Button
              onClick={() => {
                setPostSaveOpen(false);
                navigate({ to: "/" });
              }}
            >
              예, 나가기
            </Button>
          </DialogFooter>
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

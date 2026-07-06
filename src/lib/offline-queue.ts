import { get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import type { PinStatus } from "./status";

type QueueOp =
  | {
      kind: "insert";
      tempId: string;
      map_id: string;
      x_pct: number;
      y_pct: number;
      status: PinStatus;
      team_name: string;
      created_at: string;
    }
  | { kind: "delete"; id: string };

const KEY = "visit-check-queue-v1";

async function readQueue(): Promise<QueueOp[]> {
  return (await get<QueueOp[]>(KEY)) ?? [];
}
async function writeQueue(ops: QueueOp[]) {
  await set(KEY, ops);
}

export async function enqueue(op: QueueOp) {
  const q = await readQueue();
  q.push(op);
  await writeQueue(q);
  notify();
}

export async function queueSize() {
  return (await readQueue()).length;
}

let flushing = false;
export async function flushQueue(): Promise<{ ok: number; fail: number }> {
  if (flushing) return { ok: 0, fail: 0 };
  flushing = true;
  let ok = 0;
  let fail = 0;
  try {
    const ops = await readQueue();
    const remaining: QueueOp[] = [];
    for (const op of ops) {
      try {
        if (op.kind === "insert") {
          const { error } = await supabase.from("pins").insert({
            map_id: op.map_id,
            x_pct: op.x_pct,
            y_pct: op.y_pct,
            status: op.status,
            team_name: op.team_name,
          });
          if (error) throw error;
          ok++;
        } else {
          const { error } = await supabase.from("pins").delete().eq("id", op.id);
          if (error) throw error;
          ok++;
        }
      } catch (e) {
        console.warn("[queue] op failed, keeping:", e);
        remaining.push(op);
        fail++;
      }
    }
    await writeQueue(remaining);
  } finally {
    flushing = false;
    notify();
  }
  return { ok, fail };
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue();
  });
  // periodic retry
  setInterval(() => {
    if (navigator.onLine) flushQueue();
  }, 15000);
}

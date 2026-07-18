export type ZoneStatus = "unvisited" | "in_progress" | "abandoned" | "done";
export type Category = "done" | "gift" | "away" | "other";

export const ZONE_STATUS_META: Record<
  ZoneStatus,
  { label: string; color: string; fill: string }
> = {
  unvisited: { label: "미방문", color: "#94A3B8", fill: "rgba(148,163,184,0.28)" },
  in_progress: { label: "방문중", color: "#E29B3E", fill: "rgba(226,155,62,0.35)" },
  abandoned: { label: "미완료·중단됨", color: "#C0392B", fill: "rgba(192,57,43,0.28)" },
  done: { label: "완료", color: "#2F8F5B", fill: "rgba(47,143,91,0.35)" },
};

export const NEXT_STATUS: Record<ZoneStatus, ZoneStatus> = {
  unvisited: "in_progress",
  in_progress: "done",
  abandoned: "in_progress",
  done: "unvisited",
};

export const CATEGORY_META: Record<
  Category,
  { label: string; short: string; color: string }
> = {
  done: { label: "복음 전달 완료", short: "복음", color: "#2F8F5B" },
  gift: { label: "선물만 전달", short: "선물", color: "#E29B3E" },
  away: { label: "부재중", short: "부재", color: "#6B6F76" },
  other: { label: "기타 (재방문 자제 등)", short: "기타", color: "#B3434F" },
};

export const CATEGORY_ORDER: Category[] = ["done", "gift", "away", "other"];

export const MAX_ZONES = 5;

export type PinStatus = "done" | "gift" | "refuse" | "away" | "skip";

export const STATUS_META: Record<
  PinStatus,
  { label: string; short: string; color: string; description: string }
> = {
  done: {
    label: "복음 전달 완료",
    short: "복음전달",
    color: "#2F8F5B",
    description: "문이 열렸고 복음을 전함",
  },
  gift: {
    label: "선물만 전달",
    short: "선물전달",
    color: "#E29B3E",
    description: "문은 열렸지만 복음은 거절, 선물만 받음",
  },
  refuse: {
    label: "재방문 자제 요청",
    short: "재방문거절",
    color: "#B3434F",
    description: "명확히 재방문 원치 않음",
  },
  away: {
    label: "부재중",
    short: "부재중",
    color: "#566274",
    description: "카드+선물만 걸어두고 옴",
  },
  skip: {
    label: "방문 대상 아님",
    short: "대상아님",
    color: "#A6A6A6",
    description: "빈집·창고·공터 등",
  },
};

export const STATUS_ORDER: PinStatus[] = ["done", "gift", "refuse", "away", "skip"];

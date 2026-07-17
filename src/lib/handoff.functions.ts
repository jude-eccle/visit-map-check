import { createServerFn } from "@tanstack/react-start";

export const uploadHandoffPhoto = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      mapId: string;
      zoneId: string;
      fileBase64: string;
      contentType: string;
      ext: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(data.mapId) || !uuid.test(data.zoneId)) {
      throw new Error("Invalid id");
    }
    const contentType = String(data.contentType || "");
    if (!/^image\//.test(contentType)) throw new Error("이미지 파일만 업로드 가능합니다.");
    const ext = String(data.ext || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "jpg";
    const b64 = data.fileBase64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length === 0) throw new Error("빈 파일");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("파일이 너무 큽니다 (10MB 이하).");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: zone } = await supabaseAdmin
      .from("zones")
      .select("id, map_id")
      .eq("id", data.zoneId)
      .maybeSingle();
    if (!zone || zone.map_id !== data.mapId) throw new Error("존을 찾을 수 없습니다.");

    const path = `handoff-photos/${data.mapId}/${data.zoneId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("map-images")
      .upload(path, bytes, { upsert: false, contentType });
    if (error) throw new Error(error.message);
    return { ok: true as const, path };
  });

import { createServerFn } from "@tanstack/react-start";

function requireToken(token: unknown) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || typeof token !== "string" || token !== expected) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

function s(v: unknown, max = 500): string {
  if (typeof v !== "string") throw new Error("Invalid input");
  const t = v.trim();
  if (t.length > max) throw new Error("Too long");
  return t;
}

// ============ MAPS ============

export const adminCreateMap = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; code: string; name: string; address: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const code = s(data.code, 4);
    if (!/^\d{4}$/.test(code)) throw new Error("코드는 4자리 숫자입니다.");
    const name = s(data.name, 200);
    if (!name) throw new Error("이름 필요");
    const address = s(data.address, 500);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("maps").insert({ code, name, address });
    if (error) throw new Error(error.code === "23505" ? "duplicate_code" : error.message);
    return { ok: true as const };
  });

export const adminUpdateMap = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      id: string;
      patch: {
        name?: string;
        code?: string;
        address?: string;
        image_path?: string | null;
      };
    }) => d,
  )
  .handler(async ({ data }) => {
    requireToken(data.token);
    const patch: Record<string, unknown> = {};
    if (data.patch.name !== undefined) patch.name = s(data.patch.name, 200);
    if (data.patch.code !== undefined) {
      const c = s(data.patch.code, 4);
      if (!/^\d{4}$/.test(c)) throw new Error("코드는 4자리 숫자입니다.");
      patch.code = c;
    }
    if (data.patch.address !== undefined) patch.address = s(data.patch.address, 500);
    if (data.patch.image_path !== undefined) {
      patch.image_path = data.patch.image_path === null ? null : s(data.patch.image_path, 500);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabaseAdmin.from("maps").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.code === "23505" ? "duplicate_code" : error.message);
    return { ok: true as const };
  });

export const adminDeleteMap = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("maps")
      .select("image_path")
      .eq("id", data.id)
      .maybeSingle();
    if (m?.image_path) {
      await supabaseAdmin.storage.from("map-images").remove([m.image_path]);
    }
    const { error } = await supabaseAdmin.from("maps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminClearMapData = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("zone_events").delete().eq("map_id", data.id);
    await supabaseAdmin.from("zone_completions").delete().eq("map_id", data.id);
    await supabaseAdmin.from("support_requests").delete().eq("map_id", data.id);
    await supabaseAdmin.from("zones").update({ status: "unvisited" }).eq("map_id", data.id);
    return { ok: true as const };
  });

// ============ ZONES ============

export const adminCreateZone = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; mapId: string; name: string; orderIdx: number }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const name = s(data.name, 100);
    if (!name) throw new Error("이름 필요");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("zones")
      .insert({
        map_id: data.mapId,
        name,
        order_idx: data.orderIdx,
        x1_pct: 0,
        y1_pct: 0,
        x2_pct: 0,
        y2_pct: 0,
      })
      .select("id, map_id, name, status, order_idx")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminRenameZone = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; name: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const name = s(data.name, 100);
    if (!name) throw new Error("이름 필요");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("zones").update({ name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteZone = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("zones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSwapZoneOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; aId: string; aOrder: number; bId: string; bOrder: number }) => d,
  )
  .handler(async ({ data }) => {
    requireToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("zones").update({ order_idx: data.bOrder }).eq("id", data.aId);
    await supabaseAdmin.from("zones").update({ order_idx: data.aOrder }).eq("id", data.bId);
    return { ok: true as const };
  });

export const adminResetZoneStatuses = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; mapId: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("zones")
      .update({ status: "unvisited" })
      .eq("map_id", data.mapId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============ TEAM NAMES ============

export const adminCreateTeamName = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; name: string; orderIdx: number }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const name = s(data.name, 50);
    if (!name) throw new Error("이름 필요");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("team_names")
      .insert({ name, order_idx: data.orderIdx });
    if (error) throw new Error(error.code === "23505" ? "duplicate_name" : error.message);
    return { ok: true as const };
  });

export const adminRenameTeamName = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; name: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const name = s(data.name, 50);
    if (!name) throw new Error("이름 필요");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("team_names")
      .update({ name })
      .eq("id", data.id);
    if (error) throw new Error(error.code === "23505" ? "duplicate_name" : error.message);
    return { ok: true as const };
  });

export const adminDeleteTeamName = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    requireToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("team_names").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSwapTeamOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; aId: string; aOrder: number; bId: string; bOrder: number }) => d,
  )
  .handler(async ({ data }) => {
    requireToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_names").update({ order_idx: data.bOrder }).eq("id", data.aId);
    await supabaseAdmin.from("team_names").update({ order_idx: data.aOrder }).eq("id", data.bId);
    return { ok: true as const };
  });

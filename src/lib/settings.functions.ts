import { createServerFn } from "@tanstack/react-start";

export const getLeaderPhone = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "leader_phone")
    .maybeSingle();
  return { value: data?.value ?? "" };
});

export const setLeaderPhone = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; value: string }) => {
    if (typeof data?.token !== "string" || typeof data?.value !== "string") {
      throw new Error("Invalid input");
    }
    if (data.value.length > 40) throw new Error("Phone too long");
    return data;
  })
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected || data.token !== expected) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "leader_phone", value: data.value.trim() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

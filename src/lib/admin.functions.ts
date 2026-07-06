import { createServerFn } from "@tanstack/react-start";

export const verifyAdminToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) return { ok: false as const };
    return { ok: data.token === expected };
  });

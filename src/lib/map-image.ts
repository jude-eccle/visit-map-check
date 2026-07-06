import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

export async function getMapImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (cache.has(path)) return cache.get(path)!;
  const { data, error } = await supabase.storage
    .from("map-images")
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7일
  if (error || !data) return null;
  cache.set(path, data.signedUrl);
  return data.signedUrl;
}

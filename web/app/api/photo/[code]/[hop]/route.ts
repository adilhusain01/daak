import { handoffsFor } from "@/lib/arkiv";
import { downloadPhoto, openRef } from "@/lib/swarm";

/** The lid photo of one handoff: Daak unseals the Swarm reference from Arkiv and streams the image. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string; hop: string }> }) {
  const { code, hop } = await ctx.params;
  const h = (await handoffsFor(code)).find((x) => x.hop === Number(hop) && x.photo);
  if (!h?.photo) return new Response("No photo for this handoff", { status: 404 });
  const img = await downloadPhoto(openRef(h.photo));
  return new Response(img, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}

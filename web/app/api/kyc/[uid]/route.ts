import { denied, isOperator } from "@/lib/auth";
import { getBadge } from "@/lib/arkiv";
import { downloadPhoto, openRef, unseal } from "@/lib/swarm";

/** The ID photo of one driver, operator only: unsealed from Arkiv, fetched encrypted from Swarm, never cached. */
export async function GET(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isOperator(req)) return denied("operator");
  const b = await getBadge(decodeURIComponent((await ctx.params).uid));
  if (!b?.kyc) return new Response("No ID on file", { status: 404 });
  const { photo } = JSON.parse(unseal(b.kyc, "kyc")) as { photo: string };
  const img = await downloadPhoto(openRef(photo));
  return new Response(img, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}

import { parcelPrompt, parseAnswer, type Check } from "./zg";

/**
 * The backup check, used only when 0G cannot answer. It asks the same question of an ordinary hosted vision model:
 * Cloudflare Workers AI when CF_ACCOUNT_ID and CF_AI_TOKEN are set, otherwise Gemini when GEMINI_API_KEY is set.
 * It is not sealed and is always labelled as the backup. It can only make a handoff safer: a problem it sees holds
 * the payment at once; a pass leaves the payment waiting for 0G's recheck (unless BACKUP_PAYS=1, for testing).
 */
export type Backup = Omit<Check, "verified" | "requestId"> & { provider: "cloudflare" | "gemini" };

export const BACKUP_PAYS = process.env.BACKUP_PAYS === "1";
export const BACKUP_BUDGET_MS = Number(process.env.BACKUP_BUDGET_MS ?? 15000);

function provider() {
  if (process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN) {
    return {
      name: "cloudflare" as const,
      url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`,
      key: process.env.CF_AI_TOKEN,
      model: process.env.CF_VISION_MODEL ?? "@cf/meta/llama-4-scout-17b-16e-instruct",
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      name: "gemini" as const,
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash",
    };
  }
  return null;
}

export const backupReady = () => provider() !== null;

/** Any question about a photo, asked of the backup model (Cloudflare first). Not sealed; callers label it as the backup. */
export async function askBackup(photo: Buffer, prompt: string, budgetMs = BACKUP_BUDGET_MS): Promise<{ content: string; model: string; provider: "cloudflare" | "gemini" }> {
  const p = provider();
  if (!p) throw new Error("No backup model configured");
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
    signal: AbortSignal.timeout(budgetMs),
    body: JSON.stringify({
      model: p.model,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photo.toString("base64")}` } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`backup ${p.name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? "", model: p.model, provider: p.name };
}

export async function backupCheck(photo: Buffer, expectedCode: string, hopLabel: string): Promise<Backup> {
  const r = await askBackup(photo, parcelPrompt(expectedCode, hopLabel));
  return { ...parseAnswer(r.content), model: r.model, provider: r.provider };
}

/** What a backup answer means for the handoff: a problem holds it; a pass waits for 0G (or pays, in test mode). */
export function backupVerdict(b: Backup, rightPeople: boolean, rightPlace: boolean): "green" | "held" | "unchecked" {
  if (!rightPeople || !rightPlace) return "held";
  if (!b.match || b.condition === "damaged" || b.condition === "opened") return "held";
  return BACKUP_PAYS && b.condition === "intact" ? "green" : "unchecked";
}

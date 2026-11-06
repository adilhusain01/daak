import { denied, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ask, assistantReady } from "@/lib/assistant";
import { logHandoff } from "@/lib/hedera";

/**
 * The operator asks the assistant a question. Every question is audited on the HCS log by its hash, with the tools
 * the assistant used and what it proposed; the question text itself stays private.
 */
export async function POST(req: Request) {
  if (!isOperator(req)) return denied("operator");
  if (!assistantReady()) return NextResponse.json({ error: "The assistant needs CF_ACCOUNT_ID and CF_AI_TOKEN" }, { status: 503 });
  const { question } = (await req.json()) as { question: string };
  const q = String(question ?? "").trim().slice(0, 500);
  if (!q) return NextResponse.json({ error: "Ask a question" }, { status: 400 });
  try {
    const r = await ask(q);
    const hcs = await logHandoff({
      t: "daak.assistant", q: createHash("sha256").update(q).digest("hex").slice(0, 16),
      tools: r.toolsUsed, proposed: r.proposals.map((p) => `${p.action}:${p.code}`),
    }).catch(() => null);
    return NextResponse.json({ ...r, hcs });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { denied, isApp, isOperator } from "@/lib/auth";
import { setDevicePub } from "@/lib/arkiv";

/** The app registers the phone's signing key for the signed-in person. A second phone needs the operator. */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { uid, devicePub } = (await req.json()) as { uid: string; devicePub: string };
  if (!uid || !devicePub || devicePub.length > 128) return NextResponse.json({ error: "Bad key" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await setDevicePub(uid, devicePub, isOperator(req))) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 409 });
  }
}

import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/** Daak's Google OAuth web client id. Public: the app asks Google for a token for it, and the server checks it. */
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "473227099187-pua5v04qh0huu4l7dgor7sgf2i9qrkm0.apps.googleusercontent.com";

/** A Google account's Daak id: a hash of Google's stable account id, so records never carry the account itself. */
export const googleUid = (sub: string) => "g:" + createHash("sha256").update(`google:${sub}`).digest("hex").slice(0, 20);

const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Checks a Google ID token from the phone: signed by Google, for Daak, unexpired, with a verified email. */
export async function verifyGoogle(idToken: string) {
  const { payload } = await jwtVerify(idToken, keys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: GOOGLE_CLIENT_ID });
  if (!payload.sub || payload.email_verified !== true) throw new Error("Google did not confirm this account's email");
  return { uid: googleUid(payload.sub), email: String(payload.email ?? ""), name: String(payload.name ?? ""), givenName: String(payload.given_name ?? "") };
}

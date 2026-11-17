import "server-only";
import { ZodError } from "zod";
import { authConfig } from "./config";
import { AccessError } from "@/modules/identity/errors";
export function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
export function assertOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(authConfig().appUrl).origin) throw new AccessError("FORBIDDEN");
}
export async function readJson(request: Request, limit = 8192) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AccessError("FORBIDDEN");
  // Stream limit applies even without a Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new SyntaxError(); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
export function failure(error: unknown) {
  if (error instanceof AccessError) {
    const messages = { UNAUTHORIZED: "Přihlaste se prosím znovu.", ACCOUNT_BLOCKED: "Účet zatím nemá povolený přístup. Obraťte se na provozovatele.", FORBIDDEN: "Tato operace není povolená." };
    return json({ code: error.code, message: messages[error.code] }, error.code === "UNAUTHORIZED" ? 401 : 403);
  }
  if (error instanceof ZodError || error instanceof SyntaxError) return json({ code: "VALIDATION_ERROR", message: "Zkontrolujte zadané údaje. Jméno může mít nejvýše 80 znaků." }, 400);
  return json({ code: "UNAVAILABLE", message: "Služba nyní není dostupná. Zkuste to prosím později." }, 503);
}

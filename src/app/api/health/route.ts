export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Potvrzuje pouze běh aplikace, nikoli dostupnost DB nebo Auth.
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}

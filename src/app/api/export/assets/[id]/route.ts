import { exportResponse } from '@/server/export';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
 return exportResponse(request, (await context.params).id);
}

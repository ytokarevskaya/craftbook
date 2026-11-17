import { exportResponse } from '@/server/export';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return exportResponse(request); }

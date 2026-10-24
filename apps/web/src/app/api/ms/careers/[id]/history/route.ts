import { HistoryQuery } from '@/lib/schemas';
import { getHistory } from '@/server/careers';
import { handle, json, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function GET(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const { id } = await context.params;
    const q = HistoryQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
    return json(await getHistory(playerId, id, q.instrumentId, q.days));
  });
}

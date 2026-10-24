import { getDashboard } from '@/server/careers';
import { handle, json, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** World desk series: net worth since day one, the index, short price trails. */
export function GET(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const { id } = await context.params;
    return json(await getDashboard(playerId, id));
  });
}

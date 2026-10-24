import { DeskActionBody } from '@/lib/schemas';
import { deskAction } from '@/server/careers';
import { handle, idempotencyKey, json, readJson, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** IPO bids, fund orders, SIPs, deposits, instant trades, crypto custody and forecasts. */
export function POST(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const key = idempotencyKey(req);
    const body = DeskActionBody.parse(await readJson(req));
    const { id } = await context.params;
    return json(await deskAction(playerId, id, key, body));
  });
}

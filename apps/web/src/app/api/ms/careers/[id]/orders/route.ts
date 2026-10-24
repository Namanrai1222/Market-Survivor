import { PlaceOrderBody } from '@/lib/schemas';
import { placeCareerOrder } from '@/server/careers';
import { handle, idempotencyKey, json, readJson, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function POST(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const key = idempotencyKey(req);
    const body = PlaceOrderBody.parse(await readJson(req));
    const { id } = await context.params;
    return json(await placeCareerOrder(playerId, id, key, body));
  });
}

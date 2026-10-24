import { CancelOrderBody, OrderIdParam } from '@/lib/schemas';
import { cancelCareerOrder } from '@/server/careers';
import { handle, idempotencyKey, json, readJson, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string; orderId: string }>;
}

export function DELETE(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const key = idempotencyKey(req);
    const body = CancelOrderBody.parse(await readJson(req));
    const { id, orderId: rawOrderId } = await context.params;
    const orderId = OrderIdParam.parse(rawOrderId);
    return json(await cancelCareerOrder(playerId, id, orderId, key, body.expectedVersion));
  });
}

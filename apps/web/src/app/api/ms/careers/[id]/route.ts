import { getCareer, removeCareer } from '@/server/careers';
import { handle, json, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function GET(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const { id } = await context.params;
    return json(await getCareer(playerId, id));
  });
}

export function DELETE(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const { id } = await context.params;
    return json(await removeCareer(playerId, id));
  });
}

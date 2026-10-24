import { AdvanceBody } from '@/lib/schemas';
import { advanceCareer } from '@/server/careers';
import { handle, idempotencyKey, json, readJson, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function POST(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const key = idempotencyKey(req);
    const body = AdvanceBody.parse(await readJson(req));
    const { id } = await context.params;
    return json(await advanceCareer(playerId, id, key, body));
  });
}

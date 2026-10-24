import { CheckpointBody } from '@/lib/schemas';
import { answerCareerCheckpoint } from '@/server/careers';
import { handle, idempotencyKey, json, readJson, requirePlayer } from '@/server/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Answer the story checkpoint that paused the clock. */
export function POST(req: Request, context: RouteContext) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const key = idempotencyKey(req);
    const body = CheckpointBody.parse(await readJson(req));
    const { id } = await context.params;
    return json(await answerCareerCheckpoint(playerId, id, key, body));
  });
}

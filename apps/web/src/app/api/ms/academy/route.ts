import { AcademyBody } from '@/lib/schemas';
import { submitLesson } from '@/server/player';
import { handle, json, readJson, requirePlayer } from '@/server/http';

/** Score a lesson quiz on the server and keep the best attempt. */
export function POST(req: Request) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    const body = AcademyBody.parse(await readJson(req));
    return json(await submitLesson(playerId, body));
  });
}

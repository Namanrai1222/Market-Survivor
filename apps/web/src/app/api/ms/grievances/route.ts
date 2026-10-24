import { GrievanceBody } from '@/lib/schemas';
import { fileGrievance } from '@/server/player';
import { handle, json, playerSession, readJson } from '@/server/http';

/** Complaints and requests (Online Gaming Rules 2026 grievance mechanism). Open to anyone, rate-limited. */
export function POST(req: Request) {
  return handle(async () => {
    const { playerId, setCookie } = playerSession(req);
    const body = GrievanceBody.parse(await readJson(req));
    return json(await fileGrievance(playerId, body), { status: 201, setCookie });
  });
}

import { CreateCareerBody } from '@/lib/schemas';
import { listCareers, newCareer } from '@/server/careers';
import { handle, json, playerSession, readJson } from '@/server/http';

export function GET(req: Request) {
  return handle(async () => {
    const { playerId, setCookie } = playerSession(req);
    return json(await listCareers(playerId), { setCookie });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const { playerId, setCookie } = playerSession(req);
    const body = CreateCareerBody.parse(await readJson(req));
    return json(await newCareer(playerId, body), { status: 201, setCookie });
  });
}

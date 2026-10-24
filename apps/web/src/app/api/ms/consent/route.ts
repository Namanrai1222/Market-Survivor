import { ConsentBody } from '@/lib/schemas';
import { recordConsent } from '@/server/player';
import { handle, json, playerSession, readJson } from '@/server/http';

/** Age confirmation + acceptance of the current Terms and Privacy Notice. */
export function POST(req: Request) {
  return handle(async () => {
    const { playerId, setCookie } = playerSession(req);
    const body = ConsentBody.parse(await readJson(req));
    return json({ consent: await recordConsent(playerId, body) }, { setCookie });
  });
}

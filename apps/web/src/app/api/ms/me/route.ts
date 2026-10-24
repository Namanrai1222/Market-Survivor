import { deleteMyData, me } from '@/server/player';
import { clearSessionCookie, handle, json, playerSession, requirePlayer } from '@/server/http';

/** The player's consent status, progress and XP. */
export function GET(req: Request) {
  return handle(async () => {
    const { playerId, setCookie } = playerSession(req);
    return json(await me(playerId), { setCookie });
  });
}

/** "Delete my data": removes every record for this player and ends the session (DPDP erasure). */
export function DELETE(req: Request) {
  return handle(async () => {
    const playerId = requirePlayer(req);
    return json(await deleteMyData(playerId), { setCookie: clearSessionCookie() });
  });
}

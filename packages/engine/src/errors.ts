export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_QTY'
  | 'MARKET_HALTED'
  | 'DESK_LOCKED'
  | 'ENDED'
  | 'CHECKPOINT';

/** Expected, player-facing rule violation. Message is shown as-is in the UI. */
export class GameError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/** A money/quantity invariant broke. Always a bug; the mutation must be aborted. */
export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantError';
  }
}

// Strict request schemas (security.md §3.3): unknown fields are rejected (TC-SEC-08).
import { z } from 'zod';

const version = z.number().int().positive();
const paise = z.number().int().positive();

const difficulty = z.enum(['CALM', 'REALISTIC', 'CHAOTIC']);

/** Story and Free Play live in save slots 1–3; Daily and Time Machine are side runs the server places. */
export const CreateCareerBody = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('STORY'), slot: z.number().int().min(1).max(3), difficulty }),
  z.strictObject({ type: z.literal('FREEPLAY'), slot: z.number().int().min(1).max(3), difficulty }),
  z.strictObject({ type: z.literal('DAILY') }),
  z.strictObject({ type: z.literal('TIMEMACHINE'), scenarioId: z.string().regex(/^TM-[A-Z-]{3,30}$/) }),
]);

export const CheckpointBody = z.strictObject({
  expectedVersion: version,
  checkpointId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  choiceId: z.string().regex(/^[a-z0-9-]{2,40}$/),
});

/** DPDP consent + age confirmation (legal review L-04/L-05). Both must be literally true. */
export const ConsentBody = z.strictObject({
  ageConfirmed: z.literal(true),
  acceptTerms: z.literal(true),
  termsVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const GrievanceBody = z.strictObject({
  category: z.enum(['bug', 'account', 'privacy', 'content', 'other']),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(2000),
  email: z.email().max(200).optional().or(z.literal('').transform(() => undefined)),
});

export const AcademyBody = z.strictObject({
  lessonId: z.string().regex(/^[a-z0-9-]{2,40}$/),
  answers: z.array(z.number().int().min(0).max(5)).min(1).max(10),
});

export const AdvanceBody = z.strictObject({ expectedVersion: version, days: z.number().int().min(1).max(30) });

export const PlaceOrderBody = z.strictObject({
  expectedVersion: version,
  desk: z.literal('STOCKS'),
  instrumentId: z.string().regex(/^[A-Z0-9_]{1,20}$/),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'SL', 'SL-M']),
  qty: z.number().int().min(1).max(10_000),
  limitPaise: paise.nullable().optional(),
  triggerPaise: paise.nullable().optional(),
});

export const CancelOrderBody = z.strictObject({ expectedVersion: version });

const instrumentId = z.string().regex(/^[A-Z0-9_]{1,20}$/);
const refId = z.string().regex(/^[A-Z]{1,2}\d{1,9}$/);
const units = z.number().int().min(1).max(1e13);

/** One endpoint for every desk beyond the stock order book. Each action is a strict object. */
export const DeskActionBody = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('TRADE'), expectedVersion: version, instrumentId, side: z.enum(['BUY', 'SELL']), qty: units }),
  z.strictObject({ kind: z.literal('CUSTODY'), expectedVersion: version, instrumentId, to: z.enum(['SELF', 'EXCHANGE']), qty: units }),
  z.strictObject({ kind: z.literal('FUND_BUY'), expectedVersion: version, fundId: instrumentId, amountPaise: paise.max(1e12) }),
  z.strictObject({ kind: z.literal('FUND_REDEEM'), expectedVersion: version, fundId: instrumentId, units }),
  z.strictObject({ kind: z.literal('FUND_CANCEL'), expectedVersion: version, orderId: refId }),
  z.strictObject({ kind: z.literal('SIP_START'), expectedVersion: version, fundId: instrumentId, amountPaise: paise.max(1e10), dayOfMonth: z.number().int().min(1).max(28), stepUpPct: z.number().min(0).max(25) }),
  z.strictObject({ kind: z.literal('SIP_STOP'), expectedVersion: version, sipId: refId }),
  z.strictObject({ kind: z.literal('IPO_APPLY'), expectedVersion: version, ipoId: instrumentId, lots: z.number().int().min(1).max(100) }),
  z.strictObject({ kind: z.literal('IPO_WITHDRAW'), expectedVersion: version, ipoId: instrumentId }),
  z.strictObject({ kind: z.literal('FD_BOOK'), expectedVersion: version, tenorId: z.string().regex(/^[0-9]{1,2}[DY]$/), amountPaise: paise.max(1e12) }),
  z.strictObject({ kind: z.literal('FD_BREAK'), expectedVersion: version, fdId: refId }),
  z.strictObject({ kind: z.literal('FORECAST'), expectedVersion: version, forecastId: refId, outcome: z.enum(['YES', 'NO']), side: z.enum(['BUY', 'SELL']), shares: z.number().int().min(1).max(1000) }),
  z.strictObject({ kind: z.literal('NEXT_CHAPTER'), expectedVersion: version }),
]);
export type DeskActionBody = z.infer<typeof DeskActionBody>;
export const HistoryQuery = z.strictObject({
  instrumentId: z.string().regex(/^[A-Z0-9_]{1,20}$/),
  days: z.coerce.number().int().min(1).max(800).default(250),
});
export const OrderIdParam = z.string().regex(/^O\d{1,9}$/);

export type CreateCareerBody = z.infer<typeof CreateCareerBody>;
export type CheckpointBody = z.infer<typeof CheckpointBody>;
export type ConsentBody = z.infer<typeof ConsentBody>;
export type GrievanceBody = z.infer<typeof GrievanceBody>;
export type AcademyBody = z.infer<typeof AcademyBody>;
export type AdvanceBody = z.infer<typeof AdvanceBody>;
export type PlaceOrderBody = z.infer<typeof PlaceOrderBody>;

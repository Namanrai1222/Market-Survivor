import type { CareerSummary, CareerView, DeskFill, Order } from '@ms/engine';
import type { Progress } from '@/server/player';
import type { StoryView } from '@/server/story';
import type { AcademyBody, AdvanceBody, CheckpointBody, CreateCareerBody, DeskActionBody, GrievanceBody, PlaceOrderBody } from './schemas';
import { TERMS_VERSION } from './modes';

export type { StoryView };

export interface RunInfo {
  kind: 'DAILY' | 'TIMEMACHINE';
  dailyDate: string | null;
  scenarioId: string | null;
  returnPct: number;
}
export type SideRun = CareerSummary & { run: RunInfo | null };

export interface MeInfo {
  consent: { termsVersion: string; at: string } | null;
  termsVersion: string;
  progress: Progress;
  xp: number;
}

export interface AlertMessage {
  level: 'INFO' | 'WATCH' | 'WARNING' | 'CRITICAL' | 'HALT';
  date: string;
  message: string;
}

export interface CareerEnvelope {
  career: CareerView;
  treasury: CareerView['treasury'];
  netWorthPaise: number;
  stateVersion: number;
  newAlerts: AlertMessage[];
  story: StoryView | null;
  run: RunInfo | null;
  result?: {
    order?: Order;
    fill?: DeskFill;
    amountPaise?: number;
    days?: number;
    paused?: 'HALT' | 'CHECKPOINT' | 'ENDED' | null;
    reply?: string;
  };
  replayed?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly freshCareer?: CareerView,
  ) {
    super(message);
  }
}

const key = (): string => crypto.randomUUID().replaceAll('-', '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const data = (await response.json()) as {
    error?: { code: string; message: string };
    career?: CareerView;
  } & T;
  if (!response.ok) {
    throw new ApiError(data.error?.message ?? 'Request failed.', data.error?.code ?? 'UNKNOWN', response.status, data.career);
  }
  return data;
}

export const api = {
  listCareers: () => request<{ careers: CareerSummary[]; daily: SideRun | null; timeMachine: SideRun | null }>('/api/ms/careers'),
  me: () => request<MeInfo>('/api/ms/me'),
  consent: () => request<{ consent: MeInfo['consent'] }>('/api/ms/consent', { method: 'POST', body: JSON.stringify({ ageConfirmed: true, acceptTerms: true, termsVersion: TERMS_VERSION }) }),
  deleteMyData: () => request<{ deleted: boolean }>('/api/ms/me', { method: 'DELETE' }),
  grievance: (body: GrievanceBody) => request<{ ref: string }>('/api/ms/grievances', { method: 'POST', body: JSON.stringify(body) }),
  submitLesson: (body: AcademyBody) =>
    request<{ correct: number; total: number; results: { correct: boolean; answer: number; why: string }[]; progress: Progress }>('/api/ms/academy', { method: 'POST', body: JSON.stringify(body) }),
  answerCheckpoint: (id: string, body: CheckpointBody) =>
    request<CareerEnvelope>(`/api/ms/careers/${id}/checkpoint`, { method: 'POST', headers: { 'idempotency-key': key() }, body: JSON.stringify(body) }),
  createCareer: (body: CreateCareerBody) =>
    request<CareerEnvelope>('/api/ms/careers', { method: 'POST', body: JSON.stringify(body) }),
  getCareer: (id: string) => request<CareerEnvelope>(`/api/ms/careers/${id}`),
  deleteCareer: (id: string) => request<{ deleted: string }>(`/api/ms/careers/${id}`, { method: 'DELETE' }),
  advance: (id: string, body: AdvanceBody) =>
    request<CareerEnvelope>(`/api/ms/careers/${id}/advance`, {
      method: 'POST',
      headers: { 'idempotency-key': key() },
      body: JSON.stringify(body),
    }),
  placeOrder: (id: string, body: PlaceOrderBody) =>
    request<CareerEnvelope>(`/api/ms/careers/${id}/orders`, {
      method: 'POST',
      headers: { 'idempotency-key': key() },
      body: JSON.stringify(body),
    }),
  history: (id: string, instrumentId: string, days = 250) =>
    request<{ instrumentId: string; date: string; candles: { time: string; open: number; high: number; low: number; close: number; volume: number }[] }>(
      `/api/ms/careers/${id}/history?instrumentId=${encodeURIComponent(instrumentId)}&days=${days}`,
    ),
  action: (id: string, body: DeskActionBody) =>
    request<CareerEnvelope>(`/api/ms/careers/${id}/actions`, { method: 'POST', headers: { 'idempotency-key': key() }, body: JSON.stringify(body) }),
  dashboard: (id: string) =>
    request<{ date: string; worth: { time: string; value: number }[]; index: { time: string; value: number }[]; sparks: Record<string, number[]> }>(`/api/ms/careers/${id}/dashboard`),
  cancelOrder: (id: string, orderId: string, expectedVersion: number) =>
    request<CareerEnvelope>(`/api/ms/careers/${id}/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'idempotency-key': key() },
      body: JSON.stringify({ expectedVersion }),
    }),
};

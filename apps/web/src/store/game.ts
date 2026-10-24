'use client';

import type { CareerView } from '@ms/engine';
import { create } from 'zustand';
import { ApiError, api, type AlertMessage, type CareerEnvelope, type RunInfo, type StoryView } from '@/lib/api';
import type { DeskActionBody, PlaceOrderBody } from '@/lib/schemas';

/** A desk action without the version (the store adds it). Distributes over the union. */
export type DeskAction = DeskActionBody extends infer T ? (T extends DeskActionBody ? Omit<T, 'expectedVersion'> : never) : never;

interface GameState {
  career: CareerView | null;
  story: StoryView | null;
  run: RunInfo | null;
  /** Victor's reply to the last checkpoint answer, shown once. */
  reply: string | null;
  answerCheckpoint: (checkpointId: string, choiceId: string) => Promise<void>;
  clearReply: () => void;
  alerts: AlertMessage[];
  busy: boolean;
  error: string | null;
  /** Stock in focus across desks (watchlist selection, city tower → Stocks desk). */
  focusId: string;
  setFocus: (id: string) => void;
  applyEnvelope: (data: CareerEnvelope, broadcast?: boolean) => void;
  load: (id: string) => Promise<void>;
  advance: (days?: number) => Promise<void>;
  placeOrder: (body: Omit<PlaceOrderBody, 'expectedVersion'>) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  /** Any desk action beyond stock orders. Resolves with the envelope, or null when it failed (error shown). */
  act: (body: DeskAction) => Promise<CareerEnvelope | null>;
  clearError: () => void;
}

let channel: BroadcastChannel | null = null;
function broadcast(career: CareerView) {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  channel ??= new BroadcastChannel('market-survivor');
  channel.postMessage({ careerId: career.id, stateVersion: career.stateVersion });
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export const useGame = create<GameState>((set, get) => ({
  career: null,
  story: null,
  run: null,
  reply: null,
  alerts: [],
  busy: false,
  error: null,
  focusId: 'IHORIZON',
  setFocus: (id) => set({ focusId: id }),
  applyEnvelope: (data, shouldBroadcast = true) => {
    set((s) => ({ career: data.career, story: data.story, run: data.run, alerts: [...data.newAlerts, ...s.alerts].slice(0, 20), error: null }));
    if (shouldBroadcast) broadcast(data.career);
  },
  load: async (id) => {
    set({ busy: true, error: null });
    try {
      get().applyEnvelope(await api.getCareer(id), false);
    } catch (e) {
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },
  advance: async (days = 1) => {
    const career = get().career;
    if (!career || get().busy) return;
    set({ busy: true, error: null });
    try {
      get().applyEnvelope(await api.advance(career.id, { expectedVersion: career.stateVersion, days }));
    } catch (e) {
      if (e instanceof ApiError && e.freshCareer) set({ career: e.freshCareer });
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },
  placeOrder: async (body) => {
    const career = get().career;
    if (!career || get().busy) return;
    set({ busy: true, error: null });
    try {
      get().applyEnvelope(await api.placeOrder(career.id, { ...body, expectedVersion: career.stateVersion }));
    } catch (e) {
      if (e instanceof ApiError && e.freshCareer) set({ career: e.freshCareer });
      set({ error: message(e) });
      throw e;
    } finally {
      set({ busy: false });
    }
  },
  cancelOrder: async (orderId) => {
    const career = get().career;
    if (!career || get().busy) return;
    set({ busy: true, error: null });
    try {
      get().applyEnvelope(await api.cancelOrder(career.id, orderId, career.stateVersion));
    } catch (e) {
      if (e instanceof ApiError && e.freshCareer) set({ career: e.freshCareer });
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },
  act: async (body) => {
    const career = get().career;
    if (!career || get().busy) return null;
    set({ busy: true, error: null });
    try {
      const data = await api.action(career.id, { ...body, expectedVersion: career.stateVersion } as DeskActionBody);
      get().applyEnvelope(data);
      return data;
    } catch (e) {
      if (e instanceof ApiError && e.freshCareer) set({ career: e.freshCareer });
      set({ error: message(e) });
      return null;
    } finally {
      set({ busy: false });
    }
  },
  answerCheckpoint: async (checkpointId, choiceId) => {
    const career = get().career;
    if (!career || get().busy) return;
    set({ busy: true, error: null });
    try {
      const data = await api.answerCheckpoint(career.id, { expectedVersion: career.stateVersion, checkpointId, choiceId });
      get().applyEnvelope(data);
      set({ reply: data.result?.reply ?? null });
    } catch (e) {
      if (e instanceof ApiError && e.freshCareer) set({ career: e.freshCareer });
      set({ error: message(e) });
    } finally {
      set({ busy: false });
    }
  },
  clearReply: () => set({ reply: null }),
  clearError: () => set({ error: null }),
}));

export function listenForCareerChanges(careerId: string): () => void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => undefined;
  channel ??= new BroadcastChannel('market-survivor');
  const onMessage = (event: MessageEvent<{ careerId?: string; stateVersion?: number }>) => {
    const current = useGame.getState().career;
    if (event.data.careerId === careerId && current && (event.data.stateVersion ?? 0) > current.stateVersion) {
      void useGame.getState().load(careerId);
    }
  };
  channel.addEventListener('message', onMessage);
  return () => channel?.removeEventListener('message', onMessage);
}

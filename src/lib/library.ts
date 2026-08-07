import { useSyncExternalStore } from "react";

export type ShowStatus = "watching" | "pending" | "finished";

export type TrackedShow = {
  id: number;
  name: string;
  poster: string | null;
  year: string | null;
  status: ShowStatus;
  /** watched episode keys, e.g. "2-5" (season-episode) */
  watched: string[];
  totalEpisodes: number;
  hasNewEpisodes: boolean;
  lastCheckedAt: string | null;
  addedAt: string;
};

const KEY = "seriestracker.library.v1";
const CHECK_KEY = "seriestracker.lastDailyCheck";

let cache: TrackedShow[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function read(): TrackedShow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrackedShow[]) : [];
  } catch {
    return [];
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function write(next: TrackedShow[]) {
  cache = next;
  loaded = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

function getSnapshot(): TrackedShow[] {
  if (!loaded) {
    cache = read();
    loaded = true;
  }
  return cache;
}

const EMPTY: TrackedShow[] = [];

export function useLibrary(): TrackedShow[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot,
    () => EMPTY,
  );
}

export function getLibrary(): TrackedShow[] {
  return getSnapshot();
}

export function upsertShow(show: Omit<TrackedShow, "watched" | "addedAt" | "hasNewEpisodes" | "lastCheckedAt"> & Partial<TrackedShow>) {
  const list = getSnapshot();
  const existing = list.find((s) => s.id === show.id);
  const next: TrackedShow = {
    watched: [],
    hasNewEpisodes: false,
    lastCheckedAt: new Date().toISOString(),
    addedAt: new Date().toISOString(),
    ...(existing ?? {}),
    ...show,
  } as TrackedShow;
  write(existing ? list.map((s) => (s.id === show.id ? next : s)) : [next, ...list]);
}

export function removeShow(id: number) {
  write(getSnapshot().filter((s) => s.id !== id));
}

export function setStatus(id: number, status: ShowStatus) {
  write(
    getSnapshot().map((s) =>
      s.id === id ? { ...s, status, hasNewEpisodes: status === "finished" ? false : s.hasNewEpisodes } : s,
    ),
  );
}

export function epKey(season: number, episode: number) {
  return `${season}-${episode}`;
}

export function toggleEpisode(id: number, key: string, totalEpisodes: number) {
  write(
    getSnapshot().map((s) => {
      if (s.id !== id) return s;
      const watched = s.watched.includes(key)
        ? s.watched.filter((k) => k !== key)
        : [...s.watched, key];
      const complete = totalEpisodes > 0 && watched.length >= totalEpisodes;
      return {
        ...s,
        watched,
        totalEpisodes,
        status: complete ? "finished" : watched.length > 0 ? "watching" : s.status,
        hasNewEpisodes: complete ? false : s.hasNewEpisodes,
      };
    }),
  );
}

export function setSeasonWatched(id: number, keys: string[], watchedState: boolean, totalEpisodes: number) {
  write(
    getSnapshot().map((s) => {
      if (s.id !== id) return s;
      const set = new Set(s.watched);
      keys.forEach((k) => (watchedState ? set.add(k) : set.delete(k)));
      const watched = [...set];
      const complete = totalEpisodes > 0 && watched.length >= totalEpisodes;
      return {
        ...s,
        watched,
        totalEpisodes,
        status: complete ? "finished" : watched.length > 0 ? "watching" : s.status,
        hasNewEpisodes: complete ? false : s.hasNewEpisodes,
      };
    }),
  );
}

/** Applies a freshly fetched episode count; reopens finished shows with new episodes.
 *  Returns true when the show got new episodes and moved back to "Viendo". */
export function applyEpisodeCount(id: number, totalEpisodes: number): boolean {
  let reopened = false;
  write(
    getSnapshot().map((s) => {
      if (s.id !== id) return s;
      const grew = totalEpisodes > s.totalEpisodes;
      const stillComplete = s.watched.length >= totalEpisodes && totalEpisodes > 0;
      if (grew && !stillComplete && s.status === "finished") reopened = true;
      return {
        ...s,
        totalEpisodes,
        lastCheckedAt: new Date().toISOString(),
        hasNewEpisodes: grew && !stillComplete ? true : s.hasNewEpisodes && !stillComplete,
        status: grew && !stillComplete && s.status === "finished" ? "watching" : s.status,
      };
    }),
  );
  return reopened;
}

export function shouldRunDailyCheck(): boolean {
  if (typeof window === "undefined") return false;
  const last = window.localStorage.getItem(CHECK_KEY);
  if (!last) return true;
  // Compatibilidad con el formato antiguo "YYYY-MM-DD"
  const ts = last.length === 10 ? new Date(`${last}T00:00:00`).getTime() : Number(last);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > 6 * 60 * 60 * 1000;
}

export function markDailyCheckDone() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHECK_KEY, String(Date.now()));
}
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://api.themoviedb.org/3";

export type SearchResult = {
  id: number;
  name: string;
  poster: string | null;
  year: string | null;
  overview: string;
};

export type SeasonInfo = {
  seasonNumber: number;
  name: string;
  episodes: { episodeNumber: number; name: string; airDate: string | null }[];
};

export type SeriesDetail = {
  id: number;
  name: string;
  poster: string | null;
  backdrop: string | null;
  overview: string;
  year: string | null;
  status: string;
  totalEpisodes: number;
  seasons: SeasonInfo[];
};

function img(path: string | null | undefined, size = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = process.env["TMDB_API_KEY"];
  if (!key) throw new Error("TMDB_API_KEY no está configurada");
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("language", "es-ES");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  if (key.length > 40) headers["Authorization"] = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB ${res.status}: ${body}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export const searchSeries = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<SearchResult[]> => {
    const json = (await tmdb("/search/tv", {
      query: data.query,
      include_adult: "false",
    })) as { results?: Array<Record<string, never>> };
    const results = (json.results ?? []) as unknown as Array<{
      id: number;
      name: string;
      poster_path: string | null;
      first_air_date?: string;
      overview?: string;
    }>;
    return results.slice(0, 20).map((r) => ({
      id: r.id,
      name: r.name,
      poster: img(r.poster_path),
      year: r.first_air_date ? r.first_air_date.slice(0, 4) : null,
      overview: r.overview ?? "",
    }));
  });

export const getSeries = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.number() }).parse(input))
  .handler(async ({ data }): Promise<SeriesDetail> => {
    const show = (await tmdb(`/tv/${data.id}`)) as unknown as {
      id: number;
      name: string;
      poster_path: string | null;
      backdrop_path: string | null;
      overview?: string;
      first_air_date?: string;
      status?: string;
      seasons?: Array<{ season_number: number; episode_count: number }>;
    };

    const seasonNumbers = (show.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => s.season_number);

    const seasons: SeasonInfo[] = [];
    for (const n of seasonNumbers) {
      const s = (await tmdb(`/tv/${data.id}/season/${n}`)) as unknown as {
        name?: string;
        episodes?: Array<{ episode_number: number; name?: string; air_date?: string | null }>;
      };
      const today = new Date().toISOString().slice(0, 10);
      seasons.push({
        seasonNumber: n,
        name: s.name ?? `Temporada ${n}`,
        episodes: (s.episodes ?? [])
          .filter((e) => !e.air_date || e.air_date <= today)
          .map((e) => ({
            episodeNumber: e.episode_number,
            name: e.name ?? `Episodio ${e.episode_number}`,
            airDate: e.air_date ?? null,
          })),
      });
    }

    return {
      id: show.id,
      name: show.name,
      poster: img(show.poster_path),
      backdrop: img(show.backdrop_path, "w780"),
      overview: show.overview ?? "",
      year: show.first_air_date ? show.first_air_date.slice(0, 4) : null,
      status: show.status ?? "",
      totalEpisodes: seasons.reduce((acc, s) => acc + s.episodes.length, 0),
      seasons,
    };
  });

export const getEpisodeCount = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.number() }).parse(input))
  .handler(async ({ data }): Promise<{ id: number; totalEpisodes: number }> => {
    const show = (await tmdb(`/tv/${data.id}`)) as unknown as {
      seasons?: Array<{ season_number: number; episode_count: number; air_date?: string | null }>;
    };
    const today = new Date().toISOString().slice(0, 10);
    const total = (show.seasons ?? [])
      .filter((s) => s.season_number > 0 && (!s.air_date || s.air_date <= today))
      .reduce((acc, s) => acc + (s.episode_count ?? 0), 0);
    return { id: data.id, totalEpisodes: total };
  });
import { getDbConfig, getSetting } from "./db";

const TMDB_BASE = "https://api.themoviedb.org/3";

function img(path: string | null | undefined, size = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export async function getTmdbApiKey(): Promise<string> {
  const { tmdbApiKey } = getDbConfig();
  if (tmdbApiKey) return tmdbApiKey;

  const dbKey = await getSetting("tmdb_api_key");
  if (dbKey) return dbKey;

  return "";
}

async function tmdbFetch(endpoint: string, params: Record<string, string> = {}) {
  const key = await getTmdbApiKey();
  if (!key) {
    throw new Error(
      "TMDB_API_KEY no está configurada. Por favor, indícala en las opciones del add-on de Home Assistant o como variable de entorno.",
    );
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("language", "es-ES");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (key.length > 40) {
    headers["Authorization"] = `Bearer ${key}`;
  } else {
    url.searchParams.set("api_key", key);
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function searchSeries(query: string) {
  const json: any = await tmdbFetch("/search/tv", {
    query,
    include_adult: "false",
  });
  const results = json.results ?? [];
  return results.slice(0, 20).map((r: any) => ({
    id: r.id,
    name: r.name,
    poster: img(r.poster_path),
    year: r.first_air_date ? r.first_air_date.slice(0, 4) : null,
    overview: r.overview ?? "",
  }));
}

export async function getSeriesDetail(id: number) {
  const show: any = await tmdbFetch(`/tv/${id}`);
  const seasonNumbers = (show.seasons ?? [])
    .filter((s: any) => s.season_number > 0 && s.episode_count > 0)
    .map((s: any) => s.season_number);

  const seasons: any[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const n of seasonNumbers) {
    const s: any = await tmdbFetch(`/tv/${id}/season/${n}`);
    seasons.push({
      seasonNumber: n,
      name: s.name ?? `Temporada ${n}`,
      episodes: (s.episodes ?? [])
        .filter((e: any) => !e.air_date || e.air_date <= today)
        .map((e: any) => ({
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
}

export async function getEpisodeCount(id: number) {
  const show: any = await tmdbFetch(`/tv/${id}`);
  const today = new Date().toISOString().slice(0, 10);
  const total = (show.seasons ?? [])
    .filter((s: any) => s.season_number > 0 && (!s.air_date || s.air_date <= today))
    .reduce((acc: number, s: any) => acc + (s.episode_count ?? 0), 0);
  return { id, totalEpisodes: total };
}


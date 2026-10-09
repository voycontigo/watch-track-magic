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

export function useServerFn<T, R>(fn: (args: T) => Promise<R>) {
  return fn;
}

export const searchSeries = async ({
  data,
}: {
  data: { query: string };
}): Promise<SearchResult[]> => {
  const res = await fetch(`./api/tmdb/search?query=${encodeURIComponent(data.query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error al buscar series: ${res.statusText}`);
  }
  return res.json();
};

export const getSeries = async ({
  data,
}: {
  data: { id: number };
}): Promise<SeriesDetail> => {
  const res = await fetch(`./api/tmdb/series/${data.id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error al obtener detalles: ${res.statusText}`);
  }
  return res.json();
};

export const getEpisodeCount = async ({
  data,
}: {
  data: { id: number };
}): Promise<{ id: number; totalEpisodes: number }> => {
  const res = await fetch(`./api/tmdb/series/${data.id}/count`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error al contar capítulos: ${res.statusText}`);
  }
  return res.json();
};
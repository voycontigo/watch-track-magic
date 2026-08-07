import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { getSeries } from "@/lib/tmdb.functions";
import {
  applyEpisodeCount,
  epKey,
  getLibrary,
  removeShow,
  setSeasonWatched,
  setStatus,
  toggleEpisode,
  upsertShow,
  useLibrary,
  type ShowStatus,
} from "@/lib/library";

export const Route = createFileRoute("/serie/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de serie — Mis Series" },
      {
        name: "description",
        content: "Marca los capítulos vistos temporada a temporada y retoma la serie donde la dejaste.",
      },
      { property: "og:title", content: "Detalle de serie — Mis Series" },
      {
        property: "og:description",
        content: "Progreso por temporadas y capítulos de tus series.",
      },
    ],
  }),
  component: SeriePage,
});

const STATUS_LABEL: Record<ShowStatus, string> = {
  watching: "Viendo",
  pending: "Pendiente",
  finished: "Finalizada",
};

function SeriePage() {
  const { id } = useParams({ from: "/serie/$id" });
  const showId = Number(id);
  const fetchSeries = useServerFn(getSeries);
  const library = useLibrary();
  const tracked = library.find((s) => s.id === showId);

  const { data, isLoading, error } = useQuery({
    queryKey: ["series", showId],
    queryFn: () => fetchSeries({ data: { id: showId } }),
  });

  useEffect(() => {
    if (!data) return;
    const current = getLibrary().find((s) => s.id === showId);
    if (current && current.totalEpisodes !== data.totalEpisodes) {
      applyEpisodeCount(showId, data.totalEpisodes);
    }
  }, [data, showId]);

  const watched = new Set(tracked?.watched ?? []);
  const total = data?.totalEpisodes ?? tracked?.totalEpisodes ?? 0;
  const pct = total > 0 ? Math.round((watched.size / total) * 100) : 0;

  return (
    <main className="min-h-screen app-glow pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/" className="rounded-full p-1.5 hover:bg-secondary" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate text-base font-semibold">{data?.name ?? tracked?.name ?? "Serie"}</h1>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <p className="py-10 text-center text-sm text-destructive">
            No se pudo cargar la serie. {(error as Error).message}
          </p>
        )}

        {data && (
          <>
            <div className="flex gap-4">
              <div className="h-40 w-28 shrink-0 overflow-hidden rounded-2xl bg-muted poster-shadow">
                {data.poster && (
                  <img
                    src={data.poster}
                    alt={`Póster de ${data.name}`}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold leading-tight">{data.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {data.year} · {data.seasons.length} temporadas · {total} capítulos
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {watched.size}/{total} vistos ({pct}%)
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["watching", "pending", "finished"] as ShowStatus[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={tracked?.status === s ? "default" : "secondary"}
                  className="rounded-full"
                  onClick={() => {
                    if (tracked) setStatus(showId, s);
                    else
                      upsertShow({
                        id: data.id,
                        name: data.name,
                        poster: data.poster,
                        year: data.year,
                        status: s,
                        totalEpisodes: data.totalEpisodes,
                      });
                  }}
                >
                  {tracked?.status === s && <Check className="h-3.5 w-3.5" />}
                  {STATUS_LABEL[s]}
                </Button>
              ))}
              {tracked && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-destructive"
                  onClick={() => removeShow(showId)}
                >
                  <Trash2 className="h-4 w-4" /> Quitar
                </Button>
              )}
            </div>

            {data.overview && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{data.overview}</p>
            )}

            <Accordion type="multiple" className="mt-6">
              {data.seasons.map((season) => {
                const keys = season.episodes.map((e) => epKey(season.seasonNumber, e.episodeNumber));
                const seenCount = keys.filter((k) => watched.has(k)).length;
                const allSeen = keys.length > 0 && seenCount === keys.length;
                return (
                  <AccordionItem key={season.seasonNumber} value={`s${season.seasonNumber}`}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex-1 text-left">
                        {season.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {seenCount}/{keys.length}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mb-2 h-7 rounded-full text-xs"
                        onClick={() => {
                          if (!tracked)
                            upsertShow({
                              id: data.id,
                              name: data.name,
                              poster: data.poster,
                              year: data.year,
                              status: "watching",
                              totalEpisodes: data.totalEpisodes,
                            });
                          setSeasonWatched(showId, keys, !allSeen, data.totalEpisodes);
                        }}
                      >
                        {allSeen ? "Desmarcar temporada" : "Marcar temporada entera"}
                      </Button>
                      <ul className="space-y-1">
                        {season.episodes.map((ep) => {
                          const key = epKey(season.seasonNumber, ep.episodeNumber);
                          return (
                            <li key={key}>
                              <label className="flex items-center gap-3 rounded-lg px-2 py-2 active:bg-secondary">
                                <Checkbox
                                  checked={watched.has(key)}
                                  onCheckedChange={() => {
                                    if (!tracked)
                                      upsertShow({
                                        id: data.id,
                                        name: data.name,
                                        poster: data.poster,
                                        year: data.year,
                                        status: "watching",
                                        totalEpisodes: data.totalEpisodes,
                                      });
                                    toggleEpisode(showId, key, data.totalEpisodes);
                                  }}
                                />
                                <span className="min-w-0 flex-1 text-sm">
                                  <span className="text-muted-foreground">
                                    {season.seasonNumber}x{String(ep.episodeNumber).padStart(2, "0")}
                                  </span>{" "}
                                  {ep.name}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </>
        )}
      </div>
    </main>
  );
}
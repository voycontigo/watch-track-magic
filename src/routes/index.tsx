import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Plus, Search, Tv } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import { ShowCard } from "@/components/ShowCard";
import {
  applyEpisodeCount,
  getLibrary,
  markDailyCheckDone,
  shouldRunDailyCheck,
  upsertShow,
  useLibrary,
  type ShowStatus,
} from "@/lib/library";
import { getEpisodeCount, searchSeries, type SearchResult } from "@/lib/tmdb.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mis Series — viendo, pendientes y finalizadas" },
      {
        name: "description",
        content:
          "Busca series, guárdalas por estado y marca los capítulos vistos para saber siempre dónde te quedaste.",
      },
      { property: "og:title", content: "Mis Series" },
      {
        property: "og:description",
        content: "Tu biblioteca de series: viendo, pendientes y finalizadas.",
      },
    ],
  }),
  component: Index,
});

const STATUS_LABEL: Record<ShowStatus, string> = {
  watching: "Viendo",
  pending: "Pendiente",
  finished: "Finalizada",
};

function Index() {
  const library = useLibrary();
  const checkCount = useServerFn(getEpisodeCount);

  useEffect(() => {
    if (!shouldRunDailyCheck()) return;
    const shows = getLibrary();
    if (shows.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const show of shows) {
        try {
          const res = await checkCount({ data: { id: show.id } });
          if (cancelled) return;
          applyEpisodeCount(show.id, res.totalEpisodes);
        } catch {
          /* ignora fallos puntuales */
        }
      }
      if (!cancelled) markDailyCheckDone();
    })();
    return () => {
      cancelled = true;
    };
  }, [checkCount]);

  const groups: Record<ShowStatus, typeof library> = {
    watching: library.filter((s) => s.status === "watching"),
    pending: library.filter((s) => s.status === "pending"),
    finished: library.filter((s) => s.status === "finished"),
  };
  const withNew = library.filter((s) => s.hasNewEpisodes);

  return (
    <main className="min-h-screen app-glow pb-16">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Mis Series</h1>
          </div>
          <AddShowDialog />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {withNew.length > 0 && (
          <div className="mb-4 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm">
            <p className="font-medium text-primary">Hay capítulos nuevos</p>
            <p className="text-muted-foreground">
              {withNew.map((s) => s.name).join(", ")} han estrenado episodios y vuelven a estar
              incompletas.
            </p>
          </div>
        )}

        <Tabs defaultValue="watching">
          <TabsList className="grid w-full grid-cols-3 bg-secondary">
            {(["watching", "pending", "finished"] as ShowStatus[]).map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs sm:text-sm">
                {STATUS_LABEL[s]}
                <span className="ml-1 text-muted-foreground">{groups[s].length}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(["watching", "pending", "finished"] as ShowStatus[]).map((s) => (
            <TabsContent key={s} value={s} className="mt-4">
              {groups[s].length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Todavía no tienes series aquí. Pulsa “Añadir” para buscarlas.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {groups[s].map((show) => (
                    <ShowCard key={show.id} show={show} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </main>
  );
}

function AddShowDialog() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const search = useServerFn(searchSeries);
  const fetchCount = useServerFn(getEpisodeCount);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    try {
      setResults(await search({ data: { query: term.trim() } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo buscar");
    } finally {
      setLoading(false);
    }
  }

  async function add(result: SearchResult, status: ShowStatus) {
    let total = 0;
    try {
      total = (await fetchCount({ data: { id: result.id } })).totalEpisodes;
    } catch {
      /* sin conteo por ahora */
    }
    upsertShow({
      id: result.id,
      name: result.name,
      poster: result.poster,
      year: result.year,
      status,
      totalEpisodes: total,
    });
    toast.success(`${result.name} añadida a ${STATUS_LABEL[status]}`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="h-4 w-4" /> Añadir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar serie</DialogTitle>
        </DialogHeader>
        <form onSubmit={runSearch} className="flex gap-2">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ej. Dark, Severance…"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        <div className="mt-2 space-y-3">
          {results.map((r) => (
            <div key={r.id} className="flex gap-3 rounded-xl border border-border p-2">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {r.poster && (
                  <img
                    src={r.poster}
                    alt={`Póster de ${r.name}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.name} {r.year && <span className="text-muted-foreground">({r.year})</span>}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["watching", "pending", "finished"] as ShowStatus[]).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="secondary"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={() => add(r, s)}
                    >
                      {STATUS_LABEL[s]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

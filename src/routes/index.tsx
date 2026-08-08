import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Plus, Search, Tv } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import { ShowCard } from "@/components/ShowCard";
import {
  applyEpisodeCount,
  getLibrary,
  markDailyCheckDone,
  shouldRunDailyCheck,
  upsertShow,
  setAutoStatusOnNew,
  useAutoStatusOnNew,
  useLibrary,
  type ShowStatus,
} from "@/lib/library";
import { getEpisodeCount, searchSeries, type SearchResult } from "@/lib/tmdb.functions";
import {
  notify,
  requestNotificationPermission,
  useNotificationPermission,
} from "@/lib/notifications";

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
  const autoStatus = useAutoStatusOnNew();
  const notifPermission = useNotificationPermission();

  useEffect(() => {
    if (!shouldRunDailyCheck()) return;
    const shows = getLibrary();
    if (shows.length === 0) return;
    let cancelled = false;
    (async () => {
      const moved: string[] = [];
      for (const show of shows) {
        try {
          const res = await checkCount({ data: { id: show.id } });
          if (cancelled) return;
          const next = applyEpisodeCount(show.id, res.totalEpisodes);
          if (next) {
            moved.push(`${show.name} → ${STATUS_LABEL[next]}`);
            void notify(
              `Nuevos episodios de ${show.name}`,
              `La serie ha pasado a “${STATUS_LABEL[next]}”.`,
              `serie-${show.id}`,
            );
          }
        } catch {
          /* ignora fallos puntuales */
        }
      }
      if (cancelled) return;
      markDailyCheckDone();
      if (moved.length > 0) {
        toast.info(`Capítulos nuevos detectados: ${moved.join(", ")}`);
      }
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
          <div className="flex items-center gap-3">
            <NotificationsButton permission={notifPermission} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={autoStatus}
                onCheckedChange={setAutoStatusOnNew}
                aria-label="Clasificar automáticamente al detectar episodios nuevos"
              />
              <span className="hidden sm:inline">Auto-clasificar</span>
            </label>
            <AddShowDialog />
          </div>
        </div>
        {autoStatus && (
          <p className="mx-auto max-w-3xl px-4 pb-2 text-[11px] text-muted-foreground">
            La nueva tanda de episodios pasa a “Pendiente” si ibas al día, o a “Viendo” si la serie
            está a medias.
          </p>
        )}
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
  return <AddShowDialogInner />;
}

function NotificationsButton({ permission }: { permission: ReturnType<typeof useNotificationPermission> }) {
  if (permission === "unsupported") return null;
  if (permission === "granted") {
    return (
      <span
        className="text-muted-foreground"
        title="Notificaciones activadas"
        aria-label="Notificaciones activadas"
      >
        <Bell className="h-4 w-4 text-primary" />
      </span>
    );
  }
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 rounded-full"
      aria-label="Activar notificaciones de episodios nuevos"
      title="Activar notificaciones"
      disabled={permission === "denied"}
      onClick={async () => {
        const res = await requestNotificationPermission();
        if (res === "granted") {
          toast.success("Notificaciones activadas");
          void notify("Notificaciones activadas", "Te avisaré cuando haya episodios nuevos.");
        } else if (res === "denied") {
          toast.error("Has bloqueado las notificaciones en el navegador");
        }
      }}
    >
      {permission === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
    </Button>
  );
}

function AddShowDialogInner() {
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

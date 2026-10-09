import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { TrackedShow } from "@/lib/library";

export function ShowCard({ show }: { show: TrackedShow }) {
  const total = show.totalEpisodes || 0;
  const seen = show.watched.length;
  const pct = total > 0 ? Math.min(100, Math.round((seen / total) * 100)) : 0;

  return (
    <Link
      to="/serie/$id"
      params={{ id: String(show.id) }}
      className="group block active:scale-[0.98] transition-transform"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-muted poster-shadow">
        {show.poster ? (
          <img
            src={show.poster}
            alt={`Póster de ${show.name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
            {show.name}
          </div>
        )}
        {show.hasNewEpisodes && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
            <Sparkles className="h-3 w-3" /> Nuevo
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-white/80">
            {total > 0 ? `${seen}/${total} caps` : "Sin capítulos"}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">{show.name}</p>
      {show.year && <p className="text-xs text-muted-foreground">{show.year}</p>}
    </Link>
  );
}
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import {
  initDb,
  getAllShows,
  upsertShow,
  deleteShow,
  batchImportShows,
  updateShowStatus,
  toggleEpisode,
  setSeasonWatched,
  applyEpisodeCount,
  acknowledgeShows,
  getAllSettings,
  getSetting,
  setSetting,
} from "./db";
import {
  searchSeries,
  getSeriesDetail,
  getEpisodeCount,
  getTmdbApiKey,
} from "./tmdb";

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Servir archivos estáticos generados por Vite (dist)
const DIST_PATH = path.resolve(process.cwd(), "dist");

// --- API Endpoints ---

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await initDb();
    const hasKey = Boolean(await getTmdbApiKey());
    res.json({
      status: "ok",
      database: "connected",
      tmdbConfigured: hasKey,
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Shows CRUD
app.get("/api/shows", async (_req, res) => {
  try {
    const shows = await getAllShows();
    res.json(shows);
  } catch (err: any) {
    console.error("GET /api/shows error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shows", async (req, res) => {
  try {
    const show = await upsertShow(req.body);
    res.json(show);
  } catch (err: any) {
    console.error("POST /api/shows error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/shows/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await deleteShow(id);
    res.json({ success: true, id });
  } catch (err: any) {
    console.error("DELETE /api/shows/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shows/batch-import", async (req, res) => {
  try {
    const shows = req.body.shows || [];
    await batchImportShows(shows);
    res.json({ success: true, count: shows.length });
  } catch (err: any) {
    console.error("POST /api/shows/batch-import error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/shows/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, allEpisodeKeys } = req.body;
    const show = await updateShowStatus(id, status, allEpisodeKeys);
    res.json(show);
  } catch (err: any) {
    console.error("PATCH /api/shows/:id/status error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shows/:id/episode", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { key, totalEpisodes } = req.body;
    const show = await toggleEpisode(id, key, totalEpisodes);
    res.json(show);
  } catch (err: any) {
    console.error("POST /api/shows/:id/episode error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shows/:id/season", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { keys, watchedState, totalEpisodes } = req.body;
    const show = await setSeasonWatched(id, keys, watchedState, totalEpisodes);
    res.json(show);
  } catch (err: any) {
    console.error("POST /api/shows/:id/season error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shows/:id/episode-count", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { totalEpisodes } = req.body;
    const result = await applyEpisodeCount(id, totalEpisodes);
    res.json(result);
  } catch (err: any) {
    console.error("POST /api/shows/:id/episode-count error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/shows/acknowledge", async (req, res) => {
  try {
    const id = req.body.id !== undefined ? Number(req.body.id) : undefined;
    await acknowledgeShows(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("POST /api/shows/acknowledge error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Settings
app.get("/api/settings", async (_req, res) => {
  try {
    const settings = await getAllSettings();
    res.json(settings);
  } catch (err: any) {
    console.error("GET /api/settings error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/settings/:key", async (req, res) => {
  try {
    const value = await getSetting(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (err: any) {
    console.error("GET /api/settings/:key error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings/:key", async (req, res) => {
  try {
    const value = String(req.body.value ?? "");
    await setSetting(req.params.key, value);
    res.json({ success: true, key: req.params.key, value });
  } catch (err: any) {
    console.error("POST /api/settings/:key error:", err);
    res.status(500).json({ error: err.message });
  }
});

// TMDB endpoints
app.get("/api/tmdb/search", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    if (!query) return res.json([]);
    const results = await searchSeries(query);
    res.json(results);
  } catch (err: any) {
    console.error("TMDB search error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/series/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const detail = await getSeriesDetail(id);
    res.json(detail);
  } catch (err: any) {
    console.error("TMDB series detail error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tmdb/series/:id/count", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const count = await getEpisodeCount(id);
    res.json(count);
  } catch (err: any) {
    console.error("TMDB series count error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Static files and Home Assistant Ingress handler
app.use(express.static(DIST_PATH, { index: false }));

app.get("*", (req, res) => {
  const indexPath = path.join(DIST_PATH, "index.html");
  if (!fs.existsSync(indexPath)) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>My Series</title></head>
        <body style="font-family: sans-serif; padding: 2rem; background: #111; color: #fff;">
          <h1>My Series</h1>
          <p>La aplicación está iniciando o la interfaz aún no ha sido compilada.</p>
        </body>
      </html>
    `);
  }

  let html = fs.readFileSync(indexPath, "utf8");

  // Si Home Assistant envía el header X-Ingress-Path, inyectar <base>
  const ingressPath = req.headers["x-ingress-path"] as string;
  if (ingressPath) {
    const normalized = ingressPath.endsWith("/") ? ingressPath : `${ingressPath}/`;
    // Inyectar o reemplazar etiqueta <base>
    if (html.includes("<base ")) {
      html = html.replace(/<base [^>]*>/i, `<base href="${normalized}">`);
    } else {
      html = html.replace("<head>", `<head>\n    <base href="${normalized}">`);
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor My Series escuchando en http://0.0.0.0:${PORT}`);
});

initDb().catch((err) => {
  console.warn("Aviso inicializando base de datos:", err);
});


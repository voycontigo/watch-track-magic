import fs from "fs";
import { Pool, type PoolConfig } from "pg";

export type ShowStatus = "watching" | "pending" | "finished";

export type DbShow = {
  id: number;
  name: string;
  poster: string | null;
  year: string | null;
  status: ShowStatus;
  watched: string[];
  totalEpisodes: number;
  hasNewEpisodes: boolean;
  lastCheckedAt: string | null;
  addedAt: string;
};

let pool: Pool | null = null;

export function getDbConfig(): { poolConfig: PoolConfig; tmdbApiKey: string } {
  let haOptions: Record<string, any> = {};
  try {
    if (fs.existsSync("/data/options.json")) {
      const content = fs.readFileSync("/data/options.json", "utf8");
      haOptions = JSON.parse(content);
      console.log("Opciones de Home Assistant cargadas desde /data/options.json");
    }
  } catch (err) {
    console.warn("No se pudo leer /data/options.json:", err);
  }

  const databaseUrl = process.env.DATABASE_URL || haOptions.postgres_url;
  const tmdbApiKey =
    process.env.TMDB_API_KEY ||
    haOptions.tmdb_api_key ||
    "";

  if (databaseUrl) {
    return {
      poolConfig: { connectionString: databaseUrl },
      tmdbApiKey,
    };
  }

  const host =
    process.env.POSTGRES_HOST ||
    haOptions.postgres_host ||
    "localhost";
  const port = Number(
    process.env.POSTGRES_PORT ||
      haOptions.postgres_port ||
      5432,
  );
  const user =
    process.env.POSTGRES_USER ||
    haOptions.postgres_user ||
    "postgres";
  const password = String(
    process.env.POSTGRES_PASSWORD ??
      haOptions.postgres_password ??
      "postgres",
  );
  const database =
    process.env.POSTGRES_DB ||
    haOptions.postgres_database ||
    "series_tracker";

  return {
    poolConfig: {
      host,
      port,
      user,
      password,
      database,
      max: 10,
      idleTimeoutMillis: 30000,
    },
    tmdbApiKey,
  };
}

export async function initDb(): Promise<Pool> {
  if (pool) return pool;

  const { poolConfig } = getDbConfig();
  console.log(
    `Conectando a PostgreSQL (${poolConfig.host || "URL"}:${poolConfig.port || ""} / ${poolConfig.database || ""})...`,
  );

  pool = new Pool(poolConfig);

  // Intentar conectar con reintentos
  let retries = 10;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      console.log("Conexión con PostgreSQL establecida correctamente.");

      // Inicializar tablas
      await client.query(`
        CREATE TABLE IF NOT EXISTS shows (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          poster TEXT,
          year TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'watching',
          watched JSONB NOT NULL DEFAULT '[]'::jsonb,
          total_episodes INTEGER NOT NULL DEFAULT 0,
          has_new_episodes BOOLEAN NOT NULL DEFAULT FALSE,
          last_checked_at TIMESTAMPTZ,
          added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      client.release();
      break;
    } catch (err: any) {
      retries--;
      const msg = err.message || err.code || String(err);
      console.warn(
        `Aviso al conectar a PostgreSQL: ${msg}. Reintentando en 3s (${retries} intentos restantes)...`,
      );
      if (retries === 0) {
        throw new Error(`No se pudo conectar a PostgreSQL tras varios intentos: ${msg}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  return pool;
}

function mapRow(row: any): DbShow {
  return {
    id: row.id,
    name: row.name,
    poster: row.poster,
    year: row.year,
    status: row.status as ShowStatus,
    watched: Array.isArray(row.watched) ? row.watched : [],
    totalEpisodes: Number(row.total_episodes ?? 0),
    hasNewEpisodes: Boolean(row.has_new_episodes),
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
    addedAt: row.added_at ? new Date(row.added_at).toISOString() : new Date().toISOString(),
  };
}

export async function getAllShows(): Promise<DbShow[]> {
  const p = await initDb();
  const res = await p.query("SELECT * FROM shows ORDER BY updated_at DESC, added_at DESC");
  return res.rows.map(mapRow);
}

export async function upsertShow(show: DbShow): Promise<DbShow> {
  const p = await initDb();
  const res = await p.query(
    `INSERT INTO shows (id, name, poster, year, status, watched, total_episodes, has_new_episodes, last_checked_at, added_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       poster = EXCLUDED.poster,
       year = EXCLUDED.year,
       status = EXCLUDED.status,
       watched = EXCLUDED.watched,
       total_episodes = EXCLUDED.total_episodes,
       has_new_episodes = EXCLUDED.has_new_episodes,
       last_checked_at = EXCLUDED.last_checked_at,
       updated_at = NOW()
     RETURNING *`,
    [
      show.id,
      show.name,
      show.poster,
      show.year,
      show.status,
      JSON.stringify(show.watched || []),
      show.totalEpisodes || 0,
      Boolean(show.hasNewEpisodes),
      show.lastCheckedAt || new Date().toISOString(),
      show.addedAt || new Date().toISOString(),
    ],
  );
  return mapRow(res.rows[0]);
}

export async function deleteShow(id: number): Promise<void> {
  const p = await initDb();
  await p.query("DELETE FROM shows WHERE id = $1", [id]);
}

export async function batchImportShows(shows: DbShow[]): Promise<void> {
  for (const s of shows) {
    await upsertShow(s);
  }
}

export async function updateShowStatus(
  id: number,
  status: ShowStatus,
  allEpisodeKeys?: string[],
): Promise<DbShow | null> {
  const p = await initDb();
  const existing = await p.query("SELECT * FROM shows WHERE id = $1", [id]);
  if (existing.rows.length === 0) return null;
  const current = existing.rows[0];

  let watched = Array.isArray(current.watched) ? current.watched : [];
  let totalEpisodes = Number(current.total_episodes || 0);
  let hasNew = Boolean(current.has_new_episodes);

  if (status === "finished") {
    if (allEpisodeKeys && allEpisodeKeys.length > 0) {
      watched = allEpisodeKeys;
      totalEpisodes = allEpisodeKeys.length;
    }
    hasNew = false;
  }

  const res = await p.query(
    `UPDATE shows SET
      status = $1,
      watched = $2::jsonb,
      total_episodes = $3,
      has_new_episodes = $4,
      updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [status, JSON.stringify(watched), totalEpisodes, hasNew, id],
  );
  return mapRow(res.rows[0]);
}

export async function toggleEpisode(
  id: number,
  key: string,
  totalEpisodes: number,
): Promise<DbShow | null> {
  const p = await initDb();
  const existing = await p.query("SELECT * FROM shows WHERE id = $1", [id]);
  if (existing.rows.length === 0) return null;
  const current = existing.rows[0];

  const currentWatched: string[] = Array.isArray(current.watched) ? current.watched : [];
  const nextWatched = currentWatched.includes(key)
    ? currentWatched.filter((k) => k !== key)
    : [...currentWatched, key];

  const complete = totalEpisodes > 0 && nextWatched.length >= totalEpisodes;
  const nextStatus: ShowStatus = complete
    ? "finished"
    : nextWatched.length > 0
      ? "watching"
      : current.status;
  const hasNew = complete ? false : Boolean(current.has_new_episodes);

  const res = await p.query(
    `UPDATE shows SET
      watched = $1::jsonb,
      total_episodes = $2,
      status = $3,
      has_new_episodes = $4,
      updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [JSON.stringify(nextWatched), totalEpisodes, nextStatus, hasNew, id],
  );
  return mapRow(res.rows[0]);
}

export async function setSeasonWatched(
  id: number,
  keys: string[],
  watchedState: boolean,
  totalEpisodes: number,
): Promise<DbShow | null> {
  const p = await initDb();
  const existing = await p.query("SELECT * FROM shows WHERE id = $1", [id]);
  if (existing.rows.length === 0) return null;
  const current = existing.rows[0];

  const currentWatched: string[] = Array.isArray(current.watched) ? current.watched : [];
  const set = new Set(currentWatched);
  keys.forEach((k) => (watchedState ? set.add(k) : set.delete(k)));
  const nextWatched = [...set];

  const complete = totalEpisodes > 0 && nextWatched.length >= totalEpisodes;
  const nextStatus: ShowStatus = complete
    ? "finished"
    : nextWatched.length > 0
      ? "watching"
      : current.status;
  const hasNew = complete ? false : Boolean(current.has_new_episodes);

  const res = await p.query(
    `UPDATE shows SET
      watched = $1::jsonb,
      total_episodes = $2,
      status = $3,
      has_new_episodes = $4,
      updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [JSON.stringify(nextWatched), totalEpisodes, nextStatus, hasNew, id],
  );
  return mapRow(res.rows[0]);
}

export async function applyEpisodeCount(
  id: number,
  totalEpisodes: number,
): Promise<{ show: DbShow | null; assignedStatus: ShowStatus | null }> {
  const p = await initDb();
  const existing = await p.query("SELECT * FROM shows WHERE id = $1", [id]);
  if (existing.rows.length === 0) return { show: null, assignedStatus: null };
  const current = existing.rows[0];

  const watched: string[] = Array.isArray(current.watched) ? current.watched : [];
  const prevTotal = Number(current.total_episodes || 0);
  const grew = totalEpisodes > prevTotal;
  const stillComplete = totalEpisodes > 0 && watched.length >= totalEpisodes;
  const hasNew = grew && !stillComplete;

  const autoSetting = await getSetting("autoStatusOnNew");
  const auto = autoSetting !== "false" && autoSetting !== "0";

  const nextStatus: ShowStatus = watched.length >= prevTotal ? "pending" : "watching";
  const shouldMove = hasNew && (auto ? current.status !== nextStatus : current.status === "finished");
  const finalStatus: ShowStatus = shouldMove ? (auto ? nextStatus : "watching") : current.status;

  const res = await p.query(
    `UPDATE shows SET
      total_episodes = $1,
      last_checked_at = NOW(),
      has_new_episodes = $2,
      status = $3,
      updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [totalEpisodes, hasNew ? true : Boolean(current.has_new_episodes) && !stillComplete, finalStatus, id],
  );

  return {
    show: mapRow(res.rows[0]),
    assignedStatus: shouldMove ? finalStatus : null,
  };
}

export async function acknowledgeShows(id?: number): Promise<void> {
  const p = await initDb();
  if (id !== undefined) {
    await p.query("UPDATE shows SET has_new_episodes = FALSE WHERE id = $1", [id]);
  } else {
    await p.query("UPDATE shows SET has_new_episodes = FALSE");
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const p = await initDb();
  const res = await p.query("SELECT value FROM settings WHERE key = $1", [key]);
  return res.rows.length > 0 ? res.rows[0].value : null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const p = await initDb();
  const res = await p.query("SELECT key, value FROM settings");
  const out: Record<string, string> = {};
  for (const row of res.rows) {
    out[row.key] = row.value;
  }
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const p = await initDb();
  await p.query(
    `INSERT INTO settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}


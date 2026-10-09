# My Series — Home Assistant Add-on

Seguimiento de series de televisión integrado directamente en Home Assistant, con almacenamiento en **PostgreSQL** y sincronización de metadatos mediante la API de **The Movie Database (TMDB)**.

## Características

- **Sin dependencias externas ni servidores de terceros**: todo se ejecuta localmente en tu Home Assistant.
- **Base de datos PostgreSQL**:
  - **Modo interno automático**: si no tienes un servidor PostgreSQL, el add-on inicia y mantiene su propio cluster de PostgreSQL dentro de `/data/postgres` de forma completamente transparente y persistente.
  - **Modo externo**: si ya dispones de un servidor PostgreSQL (o del add-on oficial de PostgreSQL de Home Assistant), puedes configurarlo con host, puerto, usuario y contraseña.
- **Soporte Home Assistant Ingress**: acceso integrado directamente desde la barra lateral de Home Assistant sin necesidad de abrir puertos adicionales.
- **Sincronización con TMDB**: búsqueda en español, pósters, sinopsis, temporadas y detección automática de nuevos episodios estrenados.
- **Migración automática**: si tenías datos previos guardados en el navegador, se migran automáticamente a PostgreSQL al abrir la aplicación por primera vez.

## Configuración

En la pestaña **Configuración** del add-on en Home Assistant:

```yaml
postgres_host: localhost
postgres_port: 5432
postgres_user: postgres
postgres_password: seriespassword
postgres_database: series_tracker
tmdb_api_key: "TU_API_KEY_DE_TMDB"
```

### Opciones

- `postgres_host`: deja `localhost` para usar la base de datos interna automática o introduce la IP/nombre de host (por ejemplo `core-postgres`) de tu servidor PostgreSQL.
- `postgres_port`: puerto de PostgreSQL (por defecto `5432`).
- `postgres_user`: usuario de la base de datos (por defecto `postgres`).
- `postgres_password`: contraseña de la base de datos.
- `postgres_database`: nombre de la base de datos (por defecto `series_tracker`).
- `tmdb_api_key`: tu clave API gratuita de [The Movie Database](https://www.themoviedb.org/settings/api).

## Cómo obtener una API Key de TMDB

1. Crea una cuenta gratuita en [themoviedb.org](https://www.themoviedb.org/).
2. Ve a Configuración > API.
3. Solicita una clave de API (para desarrollador / uso personal).
4. Pega la clave API (o el Token de lectura v4) en el campo `tmdb_api_key` de la configuración del add-on.


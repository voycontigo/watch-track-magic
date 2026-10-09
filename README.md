# My Series — Home Assistant Add-on & Tracker

Aplicación de seguimiento y gestión de series de TV (viendo, pendientes y finalizadas), diseñada para ejecutarse como **Add-on en Home Assistant** con base de datos **PostgreSQL**.

![My Series](logo.png)

## Características principales

- **100% Autónomo**: Sin dependencias de servicios externos propietarios ni telemetría.
- **Base de datos PostgreSQL**: Almacenamiento fiable y concurrente de tus series, temporadas, episodios vistos y configuraciones.
  - Soporta PostgreSQL embebido/interno automático (sin configurar nada).
  - O conexión a un PostgreSQL externo (o el add-on de PostgreSQL de Home Assistant).
- **Home Assistant Ingress**: Totalmente integrado en el panel lateral de Home Assistant sin necesidad de abrir puertos hacia el exterior.
- **TMDB (The Movie Database)**: Búsqueda de series, portadas, sinopsis en español, temporadas y detección automática de estrenos de nuevos episodios.
- **PWA & Notificaciones**: Compatible con notificaciones de nuevos capítulos en el navegador.
- **Migración sin pérdidas**: Migra automáticamente los datos previos guardados en el navegador a PostgreSQL en la primera carga.

## Instalación en Home Assistant

### Opción 1: Repositorio de Add-ons (Recomendada)
1. En Home Assistant, dirígete a **Ajustes** > **Complementos** > **Tienda de complementos**.
2. Pulsa en el menú de los 3 puntos (arriba a la derecha) > **Repositorios**.
3. Añade la URL de este repositorio: `https://github.com/voycontigo/watch-track-magic`
4. Busca **My Series**, pulsa **Instalar** y luego **Iniciar**.
5. Activa la opción **Mostrar en la barra lateral**.

### Opción 2: Complemento Local
1. Copia la carpeta del proyecto a la carpeta `/addons/my_series` de tu instalación de Home Assistant (vía Samba o SSH).
2. En la Tienda de complementos, pulsa **Comprobar actualizaciones**.
3. En la sección **Complementos locales**, instala **My Series**.

## Configuración del Add-on

En la pestaña **Configuración** del add-on en Home Assistant:

```yaml
postgres_host: localhost
postgres_port: 5432
postgres_user: postgres
postgres_password: seriespassword
postgres_database: series_tracker
tmdb_api_key: "TU_API_KEY_DE_TMDB"
```

> **Nota sobre PostgreSQL**: Si dejas `postgres_host: localhost`, el add-on gestionará su propio servidor PostgreSQL interno con persistencia en `/data/postgres`. Si prefieres usar una base de datos externa, cambia `postgres_host` por la IP o el hostname correspondiente (por ejemplo `core-postgres`).

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Compilar frontend y backend
npm run build

# Iniciar servidor
npm start
```

# Voxora

Anonymous student concern system. Students submit concerns without an account and follow them with a tracking code (for example `VX-12345678`). Administrators sign in to review, answer and report on concerns.

- **Frontend:** Angular (`src/`)
- **API:** ASP.NET Core (`Voxora.Api/`), MySQL via Entity Framework Core
- **Live updates:** SignalR (`/hubs/concerns`)

## Development

You need Node.js 22.22+ (or 24.15+), the .NET 10 SDK, and MySQL 8 or MariaDB 10.6+.

1. Database: on Linux/macOS with MariaDB installed, nothing to do. `npm run dev` runs a private MariaDB in `.run/` on port 3308 and creates it from `database/schema.sql` on first start. Elsewhere (e.g. Windows), create the database yourself and set the connection string in `Voxora.Api/appsettings.Development.json`:

   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS voxora_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   mysql -u root -p voxora_db < database/schema.sql
   ```

2. Optional, to avoid browser certificate warnings: install [mkcert](https://github.com/FiloSottile/mkcert) and run `mkcert -install` once.

3. Start everything:

   ```bash
   npm install
   npm run dev        # https://localhost:4200
   npm run dev:lan    # also reachable from phones/other PCs on your network
   ```

   Shortcuts: `./dev.sh` (Linux/macOS), `dev.cmd` (Windows).

In development an admin account `admin` / `Voxora@123` is created automatically if it doesn't exist. This only applies to development; production never uses it.

Add an admin or reset a password (it asks for the password):

```bash
npm run admin -- --username NAME [--full-name "Full Name"] [--email you@example.com]
```

In production with Docker: `docker compose exec app dotnet Voxora.Api.dll create-admin --username NAME`.

Run the frontend tests with `npm test -- --watch=false`.

## Production

### With Docker (recommended)

You need a server with Docker and a domain name pointing at it, with ports 80 and 443 open.

```bash
cp .env.example .env      # fill in every value
docker compose up -d --build
```

This starts:

- **db:** MySQL 8.4. On first start the schema and starter categories are loaded from `database/schema.sql`.
- **app:** the API, which also serves the built Angular app.
- **caddy:** HTTPS with a free, auto-renewing Let's Encrypt certificate for `DOMAIN`.

The first admin account is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` (at least 12 characters). Once you've signed in, remove `ADMIN_PASSWORD` from `.env`.

Back up the `db-data` volume regularly. The `keys` volume holds the keys that encrypt admin sessions; if it's lost, admins just sign in again.

### Without Docker

1. Build the frontend: `npx ng build`. Copy `dist/compostay/browser/` to `Voxora.Api/wwwroot/`.
2. Publish the API: `dotnet publish Voxora.Api -c Release -o publish`.
3. Run `publish/Voxora.Api.dll` behind a reverse proxy that terminates HTTPS (nginx, Caddy, IIS), with these environment variables:

| Variable | Purpose |
| --- | --- |
| `ConnectionStrings__DefaultConnection` | MySQL connection string (required) |
| `AdminBootstrap__Username`, `AdminBootstrap__Password` | Creates the first admin if missing |
| `DataProtection__KeysPath` | Folder that keeps admin sessions valid across restarts |
| `ReverseProxy__Enabled=true` | Trust `X-Forwarded-*` from your proxy. Only set this if the app is not reachable directly. |
| `ASPNETCORE_HTTP_PORTS` | Port to listen on, e.g. `8080` |

Health checks: `GET /health` (app is running) and `GET /health/ready` (database reachable too).

## Security notes

- Admin sessions are HttpOnly, Secure, SameSite=Strict cookies. Passwords are hashed with ASP.NET Core Identity's PBKDF2 hasher.
- Only signed-in admins can list concerns, change them, or edit categories. Students can only submit concerns and look one up by its tracking code.
- Per-IP limits: 5 login attempts per minute, 20 submissions per 10 minutes, 60 tracking lookups per minute.
- Concern text is never written to the logs.

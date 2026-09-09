# Private Docker host

The application is exposed only on the host loopback address. Docker Compose
maps `127.0.0.1:3000`, and Tailscale Serve is the only remote access path.

## First run on either computer

1. Install Docker Desktop, enable its WSL 2 backend on Windows, and configure
   Docker Desktop to start when you sign in.
2. Create `.env` from `.env.example` and add the selected AI provider key.
3. Create the data folders with `New-Item -ItemType Directory runtime-data, backups`
   in PowerShell (or `mkdir runtime-data backups` on macOS).
4. Run `docker compose up -d --build`.
5. Verify locally with `curl http://127.0.0.1:3000/healthz`. It should return
   `{ "status": "healthy" }`.

The container runs migrations and the idempotent exercise seed before serving
the app. All mutable SQLite files live under `runtime-data/`.

## Private phone access

Install Tailscale on the Windows host, Mac, and phone. Enable MagicDNS and
HTTPS in the tailnet, then configure this on the active host. On Windows,
Tailscale's install folder may not be on `PATH`, so use its full executable
path in PowerShell:

```powershell
& 'C:\Program Files\Tailscale\tailscale.exe' serve --bg 3000
```

On macOS, the equivalent is:

```sh
tailscale serve --bg 3000
```

Use a distinct device name for each computer (for example
`strength-ai-win` and `strength-ai-mac`) and bookmark both MagicDNS URLs on
the phone. Configure tailnet ACLs so only your account/devices can reach the
two hosts. Do not enable Funnel, Docker public ports, router port-forwarding,
or LAN bindings.

Keep Windows awake on AC power when it is the active gym host. After a reboot,
sign in once so Docker Desktop starts; `unless-stopped` then restarts the app.

## Backups and computer handoff

Create a consistent, verified backup from the running container:

```sh
docker compose exec -T strength-ai pnpm db:backup
```

This uses SQLite's backup API, runs `integrity_check`, creates a dated `.db`
file in `backups/`, writes a SHA-256 manifest beside it, and retains the newest
30 backups. Schedule this command nightly on Windows. Run it manually on the
Mac before every handoff.

Only one computer may be the active source of truth. To move to the other
computer:

1. Stop the source: `docker compose stop strength-ai`.
2. Create and verify a final backup: `docker compose start strength-ai`, run
   the backup command above, then stop it again.
3. Copy only the resulting `.db` and its `.sha256` file to the other computer.
4. With the destination container stopped, verify the manifest (`sha256sum -c
strength-....db.sha256` on macOS; `Get-FileHash` on Windows) and copy the
   backup to `runtime-data/strength.db`.
5. Never copy `strength.db-wal` or `strength.db-shm`. Delete any stale files
   with those names in the destination `runtime-data/` directory.
6. Start the destination with `docker compose up -d`, verify `/healthz`, then
   use that host's Tailscale URL.

Local backups protect against bad releases and accidental deletion, but not a
lost computer or failed disk. Keep an encrypted external-drive copy for
disaster recovery.

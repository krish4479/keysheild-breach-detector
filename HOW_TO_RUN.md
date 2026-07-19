# How to run KeyShield

## ⚠️ First: free up memory (this is what crashed it before)

The build is memory-heavy. If your PC is low on free RAM, Docker's Linux VM
crashes mid-build with `rpc error ... EOF`. Before running:

- Close Chrome/Edge windows you don't need, Discord, extra VS Code windows.
- Aim for at least ~4–5 GB free before starting.

*(A swap safety-net was added at `C:\Users\<you>\.wslconfig` so a build spills
to disk instead of hard-crashing. It takes effect after a WSL restart — see below.)*

## Step 1 — Start Docker Desktop
Open Docker Desktop and wait until the whale icon says **running**.

*(If it was just reconfigured or is misbehaving, reset it first in PowerShell:*
`wsl --shutdown` *then reopen Docker Desktop.)*

## Step 2 — Start the app
```bash
cd "d:/IBM INTERN/keyshield"
docker compose up --build          # first run builds; later runs are fast
# add -d to run in the background:  docker compose up --build -d
```
Wait until it reports healthy, then open:

### 👉 http://localhost:3000

## Step 3 — Use it
- **Public checker (no login):** http://localhost:3000/checker
  Try `password123` (weak + breached) vs. a long passphrase (strong + safe).
- **Admin console:** http://localhost:3000/admin/login
  - Email: `admin@keyshield.local`
  - Password: `correct-horse-battery-staple-42`
  - MFA code — get the current 6-digit code in a second terminal:
    ```bash
    docker compose exec app npm run totp
    ```

## Stop it
```bash
docker compose down                # add -v to also wipe the database
```

## If the build crashes again with `EOF` / `Unavailable`
That's the memory issue, not the app. Do this:
1. Close memory-heavy apps.
2. In PowerShell: `wsl --shutdown`
3. Reopen Docker Desktop, wait for "running".
4. Retry `docker compose up --build`.

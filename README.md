# HDR2SDR

Web UI + Express/FFmpeg backend that tone-maps HDR video to SDR.

## Requirements

- Node.js
- `ffmpeg` on your `PATH` (built with `libzimg`/zscale)

## Run it on your home wifi

One command builds the UI and serves it together with the API on a single
port, so everyone on the wifi gets one URL — no proxy or CORS setup needed on
the client devices.

### 1. Install (once)

```sh
npm run setup
```

### 2. Open the port in Windows Firewall (once)

Run this in an **Administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "HDR2SDR" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
```

`-Profile Private` keeps the rule scoped to networks marked as private (your
home wifi), not public ones.

### 3. Start

```sh
npm start
```

That builds the frontend, then starts the server, which prints:

```
✅  HDR2SDR running on port 3001
    On this PC:  http://localhost:3001
    On your wifi: http://192.168.0.194:3001   ← open this on other devices
```

Open the wifi address on any phone, tablet or laptop on the same network. The
address is detected by asking the OS which interface it actually routes
through, so virtual adapters (VirtualBox, WSL, the Windows hotspot) are never
reported by mistake.

Your PC's IP can change when it reconnects. Reserve a static lease for it in
your router (DHCP reservation) if you want the URL to stay the same.

### Other scripts

| Command | What it does |
| --- | --- |
| `npm start` | Build the UI, then serve UI + API on one port |
| `npm run serve` | Serve without rebuilding (faster restart) |
| `npm run build` | Build the UI only |
| `npm run dev:backend` | Backend with nodemon reload, port 3001 |
| `npm run dev:frontend` | Vite dev server with hot reload, port 5173 |

### Changing the port

```sh
$env:PORT=8080; npm start    # PowerShell
PORT=8080 npm start          # bash
```

## Development

For hot reload, run the two dev servers in separate terminals:

```sh
npm run dev:backend
npm run dev:frontend
```

Vite proxies `/api` to the backend and listens on the LAN too, so
`http://<your-ip>:5173` works from other devices (open port 5173 in the
firewall as well if you want that).

## Mobile

The UI is laid out for phones from 320px up: single-column pipeline cards,
stacked progress stats, full-width buttons with 44px touch targets, tap
wording instead of drag-and-drop, and `dvh` sizing so the collapsing mobile
URL bar doesn't cause layout jumps.

## Note on exposure

The server has no authentication and accepts uploads up to 10 GB. It is meant
for a trusted home network — don't port-forward it to the internet.

<div align="center">

# HDR2SDR

**Convert HDR video to SDR without losing quality.**
No sign-up, no tracking, and your file is deleted the moment it is converted.

[Deploy your own](DEPLOY.md) · [How it works](#how-it-works) · [Privacy](#privacy)

</div>

---

HDR footage looks washed out, grey and flat on displays and apps that cannot
handle it — which is most of them, most of the time. The usual "fix" is to clamp
everything brighter than white, which blows out skies, windows and skin.

HDR2SDR runs the proper pipeline instead: linear light, 32-bit float maths, a
BT.2020 → BT.709 gamut conversion, and the Hable filmic curve to roll highlights
off gradually rather than cutting them dead.

## What you get back

- **Same resolution, same frame rate.** No downscaling, no cropping, no watermark.
- **Highlight detail preserved.** Hable tone mapping, not clipping.
- **No banding.** The whole chain runs in 32-bit float before it lands in 8-bit.
- **Correct colour tags.** BT.709 primaries, transfer and matrix are written into
  the file, so players do not have to guess — the usual reason a "converted"
  video still looks wrong.
- **Audio intact**, re-muxed to AAC 192k.
- **Plays everywhere.** H.264 in MP4 with faststart: every browser, phone, TV and
  editor, and it starts playing before it finishes downloading.

H.264 is used rather than the ~40% smaller H.265 on purpose. H.265 does not play
in Chrome or Firefox and breaks many editors, and a converted file you cannot
open is not much of a conversion.

## Privacy

Every one of these is enforced in [`backend/server.js`](backend/server.js), not
just promised on the page:

- **Your upload is deleted when FFmpeg exits** — success or failure, unlinked
  immediately, not queued for later cleanup.
- **Your result is deleted when you download it**, and swept away within
  `JOB_TTL_MINUTES` (default 15) if you never come back for it.
- **Your filename never reaches the server.** A job is a random UUID. The file is
  stored under that ID and your browser renames the download afterwards.
- **No accounts, no cookies, no analytics, no third-party requests.** Even the
  fonts are system fonts, specifically so Google never learns you visited.
- **Nothing is logged.** No access log, no IP on disk. Your IP is held in memory
  only, HMAC'd with a key regenerated at every restart, purely to rate-limit.

If you would rather not upload anything at all, run it yourself — see
[Run it locally](#run-it-locally). The site shows you the exact command.

## How it works

```
zscale=t=linear:npl=100      convert to linear light at a 100-nit peak
format=gbrpf32le             32-bit float GBR, so the maths cannot band
zscale=p=bt709               BT.2020 → BT.709 gamut
tonemap=tonemap=hable:desat=0  filmic S-curve; rolls highlights off
zscale=t=bt709:m=bt709:r=tv  BT.709 gamma, TV range
format=yuv420p               8-bit 4:2:0 SDR output
```

then `libx264 -crf 20`, AAC audio, BT.709 colour tags, and `+faststart`.

The single command, if you want to skip the web app entirely:

```sh
ffmpeg -i input.mp4 \
  -vf zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,\
tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p \
  -c:v libx264 -crf 20 -preset fast \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -movflags +faststart \
  output_sdr.mp4
```

## Deploying it

See **[DEPLOY.md](DEPLOY.md)** for a comparison of free hosts and step-by-step
instructions. Short version:

- **[Render](https://render.com)** — free, no card, public HTTPS URL in ten
  minutes. `render.yaml` configures it. Slow CPU, sleeps when idle.
- **[Oracle Cloud Always Free](https://www.oracle.com/cloud/free/)** — two
  dedicated ARM cores, always on, roughly 20x faster. Best free option.

```sh
docker compose up -d --build
```

Serverless hosts (Vercel, Netlify, Cloudflare Pages) cannot run this — no
FFmpeg, tiny request bodies, short timeouts.

## Run it locally

Requires **Node 20+** and **FFmpeg built with libzimg** (for `zscale`). The
server checks this at startup and tells you if it is missing.

```sh
npm run setup    # install both workspaces
npm start        # build the UI, then serve UI + API on one port
```

Open http://localhost:3001.

| Command | What it does |
| --- | --- |
| `npm start` | Build the UI, then serve UI + API on one port |
| `npm run serve` | Serve without rebuilding |
| `npm run build` | Build the UI only |
| `npm run dev:backend` | Backend with reload on :3001 |
| `npm run dev:frontend` | Vite dev server with HMR on :5173 |

### Configuration

Every limit is an environment variable — see **[.env.example](.env.example)**.
The ones that matter most:

| Variable | Default | What it does |
| --- | --- | --- |
| `MAX_UPLOAD_MB` | `500` | Upload cap. The UI reads this and displays it. |
| `JOB_TTL_MINUTES` | `15` | Hard deletion deadline for anything on disk. |
| `MAX_CONCURRENT_JOBS` | `1` | Simultaneous encodes. FFmpeg already uses all cores. |
| `VIDEO_CRF` | `20` | Lower is better quality and a bigger file. |
| `VIDEO_PRESET` | `fast` | Slower preset, smaller file, same quality. |

The frontend fetches `/api/config` for these, so the limit shown on the upload
zone can never drift from the limit the server enforces.

### API

| Route | Purpose |
| --- | --- |
| `POST /api/upload` | Multipart upload. Returns `{ jobId }` and nothing else. |
| `POST /api/convert` | Queue a job. Replays are rejected with 409. |
| `GET /api/progress/:jobId` | SSE progress stream, with heartbeats. |
| `GET /api/download/:jobId` | Streams the result, then deletes it. |
| `GET /api/config` | Limits the UI displays. |
| `GET /api/health` | `{ ok, active, queued }`. |

## Stack

React 19 · TypeScript · Tailwind 4 · Vite · Express · FFmpeg

## Licence

MIT — see [LICENSE](LICENSE).

Built by [Mirang Bhandari](https://github.com/mirb-404).

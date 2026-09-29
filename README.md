# HDR2SDR

**Fix HDR video that looks washed out and grey.**

Free, no sign up, same quality, and your file is deleted as soon as it is
converted.

[Deploy your own](DEPLOY.md) · [How it works](#how-it-works) · [Privacy](#privacy)

---

Some video is recorded in HDR, which looks flat and grey on screens and apps
that cannot handle it, and that is most of them. The usual quick fix is to clip
everything brighter than white, which turns skies, windows and faces into white
patches.

HDR2SDR does it properly instead. It converts the picture to linear light, works
in 32 bit floating point, maps the wide HDR colour range down to the standard
one, and uses the Hable filmic curve so bright areas fade off smoothly rather
than being cut flat.

## What stays the same

- **Size and sharpness.** No shrinking, no cropping, no watermark. A 4K clip
  comes back as 4K at the same frame rate.
- **Detail in bright areas.** Skies and sunsets keep their shape.
- **Smooth colour.** No blotchy banding in gradients or dark scenes.
- **Sound.** Kept, and re-encoded at AAC 192k.
- **Plays anywhere.** H.264 in an MP4, so it opens in any browser, phone, TV or
  editor, and starts playing before it finishes downloading.

H.264 is used rather than the roughly 40% smaller H.265 on purpose. H.265 does
not play in Chrome or Firefox and breaks many editors, and a converted file you
cannot open is not much of a conversion.

## Privacy

Every one of these is enforced in [`backend/server.js`](backend/server.js)
rather than only promised on the page:

- **Your upload is deleted when FFmpeg finishes**, whether it worked or not.
  Not queued for cleanup, removed immediately.
- **Your result is deleted when you download it**, and swept away within
  `JOB_TTL_MINUTES` (15 by default) if you never come back for it.
- **The filename never reaches the server.** A job is a random UUID. The file is
  stored under that ID, and your browser puts the real name back on the
  download.
- **No accounts, no cookies, no analytics, no third party requests.** Even the
  fonts are your own system fonts, so nobody else learns you visited.
- **Nothing is logged.** No access log and no addresses on disk. Your IP is held
  in memory only, hashed with a key that is regenerated at every restart, purely
  to stop one person flooding the server.

If you would rather upload nothing at all, run it yourself. The site shows you
the exact command, and so does the next section.

## How it works

```
zscale=t=linear:npl=100        convert to linear light at a 100 nit peak
format=gbrpf32le               32 bit float, so the maths cannot band
zscale=p=bt709                 wide HDR colour down to standard colour
tonemap=tonemap=hable:desat=0  filmic curve; bright areas fade off smoothly
zscale=t=bt709:m=bt709:r=tv    standard gamma and TV range
format=yuv420p                 8 bit SDR output
```

Then `libx264 -crf 20`, AAC audio, BT.709 colour tags and `+faststart`.

The whole thing as one command, if you want to skip the web app:

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

See **[DEPLOY.md](DEPLOY.md)** for a comparison of free hosts and step by step
instructions. The short version:

- **[Render](https://render.com)** is free with no card and gives you a public
  HTTPS address in about ten minutes. `render.yaml` configures it. The CPU is
  slow and it sleeps when idle.
- **[Oracle Cloud Always Free](https://www.oracle.com/cloud/free/)** gives you
  two dedicated ARM cores that never sleep, roughly 20 times faster. Best free
  option.

```sh
docker compose up -d --build
```

Serverless hosts such as Vercel, Netlify and Cloudflare Pages cannot run this.
They have no FFmpeg, tiny upload limits and short timeouts.

## Run it locally

Needs **Node 20 or newer** and **FFmpeg built with libzimg** (for `zscale`). The
server checks for this at startup and tells you if it is missing.

```sh
npm run setup    # install both halves
npm start        # build the UI, then serve the UI and API on one port
```

Then open http://localhost:3001.

| Command | What it does |
| --- | --- |
| `npm start` | Build the UI, then serve the UI and API on one port |
| `npm run serve` | Serve without rebuilding |
| `npm run build` | Build the UI only |
| `npm run dev:backend` | Backend with reload on port 3001 |
| `npm run dev:frontend` | Vite dev server with hot reload on port 5173 |

### Configuration

Every limit is an environment variable. See **[.env.example](.env.example)** for
all of them. The ones that matter most:

| Variable | Default | What it does |
| --- | --- | --- |
| `MAX_UPLOAD_MB` | `500` | Upload limit. The UI reads this and displays it. |
| `JOB_TTL_MINUTES` | `15` | Deadline after which anything on disk is deleted. |
| `MAX_CONCURRENT_JOBS` | `1` | Encodes at once. FFmpeg already uses every core. |
| `VIDEO_CRF` | `20` | Lower means better quality and a bigger file. |
| `VIDEO_PRESET` | `fast` | Slower preset, smaller file, same quality. |

The frontend reads these from `/api/config`, so the limit shown on the upload
box can never drift away from the limit the server actually enforces.

### API

| Route | Purpose |
| --- | --- |
| `POST /api/upload` | Multipart upload. Returns `{ jobId }` and nothing else. |
| `POST /api/convert` | Queue a job. Repeat calls are rejected with 409. |
| `GET /api/progress/:jobId` | Progress stream (SSE), with heartbeats. |
| `GET /api/download/:jobId` | Sends the result, then deletes it. |
| `GET /api/config` | The limits the UI displays. |
| `GET /api/health` | `{ ok, active, queued }`. |

## Built with

React 19, TypeScript, Tailwind 4, Vite, Express and FFmpeg.

## Licence

MIT. See [LICENSE](LICENSE).

Built by [Mirang Bhandari](https://github.com/mirb-404).

/**
 * HDR2SDR: HDR to SDR video tone-mapping service, built for Vercel Functions.
 *
 * Shape of a conversion, and why:
 *   1. The browser uploads straight to a *private* Vercel Blob store using a
 *      short-lived presigned URL from POST /api/upload-url. Function request
 *      bodies are capped at 4.5 MB, so the video can never pass through here.
 *   2. POST /api/convert does everything else in ONE streamed request: pull the
 *      upload to local disk, delete it from Blob, run FFmpeg, store the result,
 *      and stream progress back as NDJSON. Functions scale out, so a job that
 *      spanned several requests could land on instances that have never heard
 *      of it. One request means one instance and no shared state.
 *   3. The browser downloads the result with a presigned GET, then asks for it
 *      to be deleted via POST /api/discard.
 *
 * Privacy model (this is a promise the code has to keep, not just marketing):
 *   - No database, no accounts, no cookies, no analytics.
 *   - The original filename never leaves the browser. Blobs are named by a
 *     random UUID; the browser renames the download itself.
 *   - The upload is deleted from Blob the moment it is on the encoder's disk,
 *     and from disk the moment FFmpeg exits.
 *   - The result is deleted when the browser confirms the download, after
 *     JOB_TTL_MS, or when the instance shuts down, whichever comes first. A
 *     sweep of the store catches anything an instance crash left behind.
 *   - Client IPs are held in memory only, HMAC'd with a per-boot salt, purely
 *     to rate-limit.
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { spawn, execFile } = require('child_process');
const { get, put, del, list, issueSignedToken, presignUrl } = require('@vercel/blob');
const { handleUploadPresigned } = require('@vercel/blob/client');

// ── Configuration ────────────────────────────────────────────────────────────
const num = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PORT = num('PORT', 3001);
const HOST = process.env.HOST || '0.0.0.0';

const MAX_UPLOAD_BYTES = num('MAX_UPLOAD_MB', 500) * 1024 * 1024;
const MAX_CONCURRENT_JOBS = num('MAX_CONCURRENT_JOBS', 1);
const JOB_TTL_MS = num('JOB_TTL_MINUTES', 15) * 60 * 1000;
const FFMPEG_TIMEOUT_MS = num('FFMPEG_TIMEOUT_MINUTES', 30) * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

// The function's maxDuration. A request still running at this point is killed
// by the platform with a bare 504, so the encode is stopped a little earlier
// to leave time to say why. Keep it equal to the duration set on Vercel:
// 300 on Hobby, up to 800 on Pro. Unset on hosts with no request limit.
const MAX_DURATION_MS = num('MAX_DURATION_SECONDS', Infinity) * 1000;
// Time held back from the encode for storing the result and replying.
const SAVE_RESERVE_MS = num('SAVE_RESERVE_SECONDS', 45) * 1000;

const VIDEO_CRF = String(num('VIDEO_CRF', 20));
const VIDEO_PRESET = process.env.VIDEO_PRESET || 'fast';
const AUDIO_BITRATE = process.env.AUDIO_BITRATE || '192k';
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FFMPEG_THREADS = String(num('FFMPEG_THREADS', allottedCpus()));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const OUTPUTS_DIR = path.join(DATA_DIR, 'outputs');

const UPLOAD_LIMIT = { max: num('RATE_UPLOADS', 5), windowMs: 10 * 60 * 1000 };
const API_LIMIT = { max: num('RATE_API', 120), windowMs: 60 * 1000 };

const BLOB_CONFIGURED = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

/**
 * CPUs this process may actually use. Inside a container, os.cpus() reports
 * the host's cores, often dozens, while the cgroup quota grants one or two.
 * x264 sizes its thread pool and frame buffers from that count, so trusting
 * the host figure means far more threads than cores and several hundred MB of
 * extra frame buffers on a 2 GB instance.
 */
function allottedCpus() {
  try {
    const [quota, period] = fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim().split(/\s+/);
    if (quota !== 'max') return Math.max(1, Math.ceil(Number(quota) / Number(period)));
  } catch {
    /* not cgroup v2, or not Linux */
  }
  return typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
}

const app = express();
app.set('trust proxy', num('TRUST_PROXY_HOPS', 1));
app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));

for (const dir of [UPLOADS_DIR, OUTPUTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Security headers ─────────────────────────────────────────────────────────
// Only the browser's own uploads and downloads talk to Blob: uploads to the
// control API on vercel.com, downloads from the store's own host.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
  "font-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  if (process.env.FORCE_HSTS === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
if (ALLOWED_ORIGIN) {
  app.use((req, res, next) => {
    if (req.headers.origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

// ── Rate limiting ────────────────────────────────────────────────────────────
// Per instance, so on Vercel it slows abuse rather than stopping it outright.
// The hard limits (file size, content type, link lifetime) are enforced by
// Blob itself on every presigned URL.
const IP_SALT = crypto.randomBytes(32);
const clientKey = (req) =>
  crypto.createHmac('sha256', IP_SALT).update(req.ip || 'unknown').digest('base64');

const buckets = new Map();

function rateLimit({ max, windowMs }, scope) {
  return (req, res, next) => {
    const key = `${scope}:${clientKey(req)}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

    if (hits.length >= max) {
      buckets.set(key, hits);
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many requests. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      });
    }

    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  const longest = Math.max(UPLOAD_LIMIT.windowMs, API_LIMIT.windowMs);
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => now - t < longest);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}, 5 * 60 * 1000).unref();

// ── Blob naming ──────────────────────────────────────────────────────────────
// The browser picks `uploads/<uuid><ext>` itself, so it never has to send the
// real filename. Anything else is refused, which also stops a client from
// pointing the converter at some other blob in the store.
const ALLOWED_EXTENSIONS = [
  '.mp4', '.mkv', '.mov', '.m4v', '.webm', '.avi', '.ts', '.m2ts', '.mts', '.mxf', '.wmv', '.flv',
];
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UPLOAD_PATHNAME = new RegExp(
  `^uploads/${UUID}(${ALLOWED_EXTENSIONS.map((e) => e.replace('.', '\\.')).join('|')})$`
);
const OUTPUT_PATHNAME = new RegExp(`^outputs/${UUID}\\.mp4$`);
// Some browsers report no type at all for .mkv or .ts, so octet-stream is let
// through as well. FFmpeg decides what the file really is either way.
const UPLOAD_CONTENT_TYPES = ['video/*', 'application/octet-stream'];
const UPLOAD_URL_TTL_MS = 30 * 60 * 1000;

const isUploadPathname = (p) => typeof p === 'string' && UPLOAD_PATHNAME.test(p);
const isOutputPathname = (p) => typeof p === 'string' && OUTPUT_PATHNAME.test(p);

const safeUnlink = (file) => fsp.unlink(file).catch(() => {});
const safeDelBlob = (pathname) =>
  del(pathname).catch((err) => console.error('[blob] delete failed:', err.message));

// An Error whose message is fit to show the user as is.
class UserError extends Error {}

// ── State (per instance) ─────────────────────────────────────────────────────
// Nothing here has to survive the instance: it is only what this instance is
// doing right now, so it can clean up after itself on SIGTERM.
const jobs = new Map(); // jobId -> { controller, child, uploadPathname, outputPathname }
const pendingOutputs = new Map(); // output pathname -> expiry timer
let activeJobs = 0;
let shuttingDown = false;

// ── POST /api/upload-url ─────────────────────────────────────────────────────
// Hands the browser a presigned URL to upload one file to one exact pathname.
// Blob enforces the size cap and content type, so this route never sees bytes.
app.post('/api/upload-url', rateLimit(UPLOAD_LIMIT, 'upload'), async (req, res) => {
  if (!BLOB_CONFIGURED) {
    return res.status(503).json({ error: 'Storage is not configured on the server.' });
  }
  sweepStore();

  try {
    const result = await handleUploadPresigned({
      body: req.body,
      request: req,
      getSignedToken: async (pathname) => {
        if (!isUploadPathname(pathname)) throw new UserError('That file does not look like a video.');

        const validUntil = Date.now() + UPLOAD_URL_TTL_MS;
        const limits = {
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          allowedContentTypes: UPLOAD_CONTENT_TYPES,
        };
        const token = await issueSignedToken({ pathname, operations: ['put'], validUntil, ...limits });
        return {
          token,
          urlOptions: {
            ...limits,
            validUntil,
            addRandomSuffix: false,
            allowOverwrite: false,
            // The shortest Blob allows, so no copy lingers in the CDN cache.
            cacheControlMaxAge: 60,
          },
        };
      },
    });
    res.json(result);
  } catch (err) {
    if (!(err instanceof UserError)) console.error('[upload-url]', err.message);
    res.status(400).json({
      error: err instanceof UserError ? err.message : 'Could not prepare the upload.',
    });
  }
});

// ── POST /api/convert ────────────────────────────────────────────────────────
// Streams NDJSON: progress lines, then exactly one { done } or { error } line.
app.post('/api/convert', rateLimit(API_LIMIT, 'api'), async (req, res) => {
  const startedAt = Date.now();
  const { pathname } = req.body || {};
  if (!isUploadPathname(pathname)) return res.status(400).json({ error: 'Invalid upload.' });
  if (!BLOB_CONFIGURED) {
    return res.status(503).json({ error: 'Storage is not configured on the server.' });
  }

  // FFmpeg already uses every core this instance has. A second encode would
  // only halve the speed of both and push both past the duration limit, so
  // the browser is told to retry and will usually be routed elsewhere.
  if (shuttingDown || activeJobs >= MAX_CONCURRENT_JOBS) {
    res.setHeader('Retry-After', '5');
    return res.status(503).json({ error: 'The server is busy.', busy: true });
  }

  activeJobs++;
  sweepStore();

  const jobId = uuidv4();
  const controller = new AbortController();
  const job = {
    controller,
    child: null,
    uploadPathname: pathname,
    outputPathname: null,
    inputPath: path.join(UPLOADS_DIR, `${jobId}${path.extname(pathname)}`),
    outputPath: path.join(OUTPUTS_DIR, `${jobId}.mp4`),
  };
  jobs.set(jobId, job);

  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (payload) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(payload)}\n`);
  };
  // Proxies drop connections that go quiet, and a long download or a slow
  // first frame can be quiet for a while. A blank line is ignored by the client.
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write('\n');
  }, 15000);

  // The tab was closed or the user started over. Stop paying for the encode.
  let finished = false;
  res.on('close', () => {
    if (!finished) controller.abort();
  });

  try {
    send({ stage: 'fetching' });
    await fetchUpload(pathname, job.inputPath, controller.signal);

    // The original is on local disk now, so it leaves the store immediately.
    await safeDelBlob(pathname);
    job.uploadPathname = null;

    const deadline = startedAt + MAX_DURATION_MS - SAVE_RESERVE_MS;
    await encode(job, deadline, send);
    await safeUnlink(job.inputPath);

    send({ stage: 'saving', percent: 100 });
    const outputPathname = `outputs/${jobId}.mp4`;
    job.outputPathname = outputPathname;
    await put(outputPathname, fs.createReadStream(job.outputPath), {
      access: 'private',
      contentType: 'video/mp4',
      multipart: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      abortSignal: controller.signal,
    });
    if (controller.signal.aborted) throw new UserError('Cancelled.');

    expireOutput(outputPathname);
    job.outputPathname = null;

    send({
      done: true,
      percent: 100,
      pathname: outputPathname,
      downloadUrl: await presignDownload(outputPathname),
      expiresInMinutes: Math.round(JOB_TTL_MS / 60000),
    });
  } catch (err) {
    if (!(err instanceof UserError) && !controller.signal.aborted) {
      console.error('[convert]', err.message);
    }
    send({
      error: err instanceof UserError ? err.message : 'Conversion failed. Please try again.',
    });
  } finally {
    finished = true;
    clearInterval(heartbeat);
    jobs.delete(jobId);
    activeJobs--;
    await Promise.all([
      safeUnlink(job.inputPath),
      safeUnlink(job.outputPath),
      job.uploadPathname && safeDelBlob(job.uploadPathname),
      job.outputPathname && safeDelBlob(job.outputPathname),
    ]);
    res.end();
  }
});

async function fetchUpload(pathname, dest, signal) {
  // useCache: false reads from origin, so the video is never copied into the
  // CDN cache on the way here.
  const result = await get(pathname, { access: 'private', useCache: false, abortSignal: signal });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new UserError('That upload has expired. Please upload it again.');
  }
  if (result.blob.size && result.blob.size > MAX_UPLOAD_BYTES) {
    throw new UserError(`That file is larger than the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`);
  }
  await pipeline(Readable.fromWeb(result.stream), fs.createWriteStream(dest), { signal });
}

function encode(job, deadline, send) {
  return new Promise((resolve, reject) => {
    // The tone-mapping chain, unchanged: linear light, float32 math, BT.2020 to
    // BT.709 gamut, Hable filmic curve, then BT.709 gamma at TV range.
    const filter = [
      'zscale=t=linear:npl=100',
      'format=gbrpf32le',
      'zscale=p=bt709',
      'tonemap=tonemap=hable:desat=0',
      'zscale=t=bt709:m=bt709:r=tv',
      'format=yuv420p',
    ].join(',');

    const args = [
      '-hide_banner', '-nostdin', '-y',
      '-filter_threads', FFMPEG_THREADS,
      '-i', job.inputPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', filter,
      '-c:v', 'libx264',
      '-crf', VIDEO_CRF,
      '-preset', VIDEO_PRESET,
      '-threads', FFMPEG_THREADS,
      '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-colorspace', 'bt709',
      '-c:a', 'aac', '-b:a', AUDIO_BITRATE,
      '-movflags', '+faststart',
      '-max_muxing_queue_size', '1024',
      '-progress', 'pipe:1',
      job.outputPath,
    ];

    const child = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    job.child = child;

    let duration = 0;
    let stderrTail = '';
    let stopReason = null;

    const stop = (reason) => {
      stopReason = stopReason || reason;
      if (!child.killed) child.kill('SIGKILL');
    };

    // Whichever comes first: the platform's duration limit or our own cap.
    const budget = Math.min(FFMPEG_TIMEOUT_MS, deadline - Date.now());
    const timer = setTimeout(() => stop('timeout'), Math.max(budget, 0));
    const onAbort = () => stop('aborted');
    job.controller.signal.addEventListener('abort', onAbort, { once: true });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (duration === 0) {
        const m = text.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
        if (m) duration = +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]);
      }
      stderrTail = (stderrTail + text).slice(-4000);
    });

    let progressBuf = '';
    child.stdout.on('data', (chunk) => {
      progressBuf += chunk.toString();
      const blocks = progressBuf.split('\n');
      progressBuf = blocks.pop() ?? '';

      let out = null;
      let fps = null;
      let speed = null;
      for (const line of blocks) {
        const [key, value] = line.split('=');
        if (key === 'out_time_us') out = Number(value) / 1e6;
        else if (key === 'fps') fps = Number(value);
        else if (key === 'speed') speed = value?.trim();
      }
      if (out === null || !Number.isFinite(out)) return;

      send({
        percent: duration > 0 ? Math.min(Math.round((out / duration) * 100), 99) : 0,
        fps: Number.isFinite(fps) ? fps : 0,
        speed: speed && speed !== 'N/A' ? speed : '?',
        currentTime: out,
        duration,
      });
    });

    const settle = (err) => {
      clearTimeout(timer);
      job.controller.signal.removeEventListener('abort', onAbort);
      job.child = null;
      if (err) reject(err);
      else resolve();
    };

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error('[fatal] ffmpeg binary not found. Set FFMPEG_PATH or install ffmpeg.');
        return settle(new UserError('The video encoder is unavailable on the server. Please try again later.'));
      }
      settle(new UserError('Conversion failed to start.'));
    });

    child.on('close', (code) => {
      if (code === 0 && !stopReason) return settle();
      if (stopReason === 'aborted') return settle(new UserError('Cancelled.'));
      if (stopReason === 'timeout') {
        return settle(new UserError(
          'This video is too long to convert within the server time limit. Try a shorter clip.'
        ));
      }
      settle(new UserError(describeFailure(stderrTail)));
    });
  });
}

function describeFailure(stderrTail) {
  const tail = stderrTail.replace(new RegExp(escapeRegExp(DATA_DIR), 'g'), '');
  if (/Invalid data found|moov atom not found|does not contain any stream/i.test(tail)) {
    return 'That file could not be read as a video. It may be corrupt or incomplete.';
  }
  if (/No space left on device/i.test(tail)) {
    return 'The server ran out of space. Please try again in a few minutes.';
  }
  if (/Unknown filter|No such filter/i.test(tail)) {
    return 'The server FFmpeg build is missing the zscale filter (libzimg).';
  }
  return 'Conversion failed. The file may use an unsupported codec.';
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A GET link for exactly one blob, valid no longer than the blob itself.
async function presignDownload(pathname) {
  const validUntil = Date.now() + JOB_TTL_MS;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'get',
    pathname,
    access: 'private',
    validUntil,
    useCache: false,
  });
  return presignedUrl;
}

// Deletes a finished result after the TTL even if nobody comes back for it.
function expireOutput(pathname) {
  const timer = setTimeout(() => {
    pendingOutputs.delete(pathname);
    safeDelBlob(pathname);
  }, JOB_TTL_MS);
  timer.unref();
  pendingOutputs.set(pathname, timer);
}

// ── POST /api/discard ────────────────────────────────────────────────────────
// Called by the browser once the download has landed. The pathname is a
// random UUID that only that browser was ever told, so knowing it is the
// permission. Usually reaches a different instance than the one that made the
// file; the timer there finds the blob already gone, which is harmless.
app.post('/api/discard', rateLimit(API_LIMIT, 'api'), async (req, res) => {
  const { pathname } = req.body || {};
  if (!isOutputPathname(pathname)) return res.status(400).json({ error: 'Invalid file.' });

  const timer = pendingOutputs.get(pathname);
  if (timer) {
    clearTimeout(timer);
    pendingOutputs.delete(pathname);
  }
  await safeDelBlob(pathname);
  res.json({ ok: true });
});

// ── GET /api/config ──────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    maxUploadBytes: MAX_UPLOAD_BYTES,
    maxUploadLabel: formatBytes(MAX_UPLOAD_BYTES),
    retentionMinutes: Math.round(JOB_TTL_MS / 60000),
    codec: 'H.264 (libx264)',
    crf: Number(VIDEO_CRF),
    preset: VIDEO_PRESET,
    audio: `AAC ${AUDIO_BITRATE}`,
  });
});

// ── GET /api/health ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, active: activeJobs, storage: BLOB_CONFIGURED });
});

// ── Retention sweeps ─────────────────────────────────────────────────────────
// Every path above deletes its own files. These catch what is left when an
// instance dies without warning: blobs older than the TTL, and stray local
// files. The store sweep piggybacks on real traffic, at most once a minute per
// instance, so an idle site costs nothing.
let lastStoreSweep = 0;

function sweepStore() {
  const now = Date.now();
  if (!BLOB_CONFIGURED || now - lastStoreSweep < SWEEP_INTERVAL_MS) return;
  lastStoreSweep = now;

  (async () => {
    const cutoff = now - JOB_TTL_MS;
    for (const prefix of ['uploads/', 'outputs/']) {
      let cursor;
      do {
        const page = await list({ prefix, cursor, limit: 1000 });
        const stale = page.blobs
          .filter((b) => new Date(b.uploadedAt).getTime() < cutoff)
          .map((b) => b.url);
        if (stale.length) await del(stale);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    }
  })().catch((err) => console.error('[sweep]', err.message));
}

async function sweepDisk() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const dir of [UPLOADS_DIR, OUTPUTS_DIR]) {
    let entries = [];
    try {
      entries = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      try {
        const stat = await fsp.stat(full);
        if (stat.mtimeMs < cutoff) await safeUnlink(full);
      } catch {
        /* vanished between readdir and stat, so already gone, which is the goal */
      }
    }
  }
}

setInterval(() => { sweepDisk().catch(() => {}); }, SWEEP_INTERVAL_MS).unref();

// ── Static frontend ──────────────────────────────────────────────────────────
// Not used on Vercel, where the frontend is its own service. Kept so the
// single-image Docker build still serves the whole app.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const hasFrontendBuild = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

if (hasFrontendBuild) {
  app.use(
    express.static(FRONTEND_DIST, {
      maxAge: '1y',
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function checkFfmpeg() {
  return new Promise((resolve) => {
    execFile(FFMPEG_BIN, ['-hide_banner', '-filters'], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ ok: false, reason: 'not found' });
      if (!/\bzscale\b/.test(stdout)) return resolve({ ok: false, reason: 'built without libzimg (zscale)' });
      resolve({ ok: true });
    });
  });
}

// ── Startup ──────────────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, async () => {
  await sweepDisk().catch(() => {});

  console.log(`HDR2SDR listening on ${HOST}:${PORT}`);
  console.log(`  Max upload:   ${formatBytes(MAX_UPLOAD_BYTES)}`);
  console.log(`  Retention:    ${Math.round(JOB_TTL_MS / 60000)} min, then deleted`);
  if (Number.isFinite(MAX_DURATION_MS)) {
    console.log(`  Time budget:  ${MAX_DURATION_MS / 1000}s per request, ${SAVE_RESERVE_MS / 1000}s reserved to save`);
  }
  console.log(`  Encoder:      libx264 crf ${VIDEO_CRF} preset ${VIDEO_PRESET}, ${FFMPEG_THREADS} thread(s)`);

  if (!BLOB_CONFIGURED) {
    console.log('  ⚠  No Blob store connected (BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN). Uploads will fail.');
  }
  const ffmpegStatus = await checkFfmpeg();
  if (!ffmpegStatus.ok) {
    console.log(`  ⚠  FFmpeg ${ffmpegStatus.reason}. Conversions will fail.`);
  }
});

// Vercel sends SIGTERM when it scales an instance in, with 30s to clean up.
// Everything this instance still holds is deleted before it goes: running
// encodes, their uploads, and finished results nobody has collected yet.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received. Stopping jobs and deleting working files.`);
    server.close();

    const blobs = [...pendingOutputs.keys()];
    for (const timer of pendingOutputs.values()) clearTimeout(timer);
    pendingOutputs.clear();
    for (const job of jobs.values()) {
      job.controller.abort();
      if (job.uploadPathname) blobs.push(job.uploadPathname);
      if (job.outputPathname) blobs.push(job.outputPathname);
    }

    const forceExit = setTimeout(() => process.exit(0), 20000);
    forceExit.unref();
    await Promise.all(blobs.map(safeDelBlob));
    await fsp.rm(DATA_DIR, { recursive: true, force: true }).catch(() => {});
    process.exit(0);
  });
}

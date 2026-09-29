/**
 * HDR2SDR — HDR to SDR video tone-mapping service.
 *
 * Privacy model (this is a promise the code has to keep, not just marketing):
 *   - No database, no accounts, no cookies, no analytics, no third-party calls.
 *   - The original filename is never sent to or stored by the server. A job is
 *     a random UUID and nothing else; the browser remembers the name and uses
 *     it to name the download.
 *   - The upload is deleted the moment the encode finishes.
 *   - The result is deleted as soon as it is downloaded, and unconditionally
 *     after JOB_TTL_MS whether or not anyone came back for it.
 *   - Nothing about a request is written to disk. Client IPs are held in memory
 *     only, HMAC'd with a salt generated fresh at boot, purely to rate-limit.
 */

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { v4: uuidv4, validate: isUuid } = require('uuid');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const dgram = require('dgram');
const { spawn, execFile } = require('child_process');

// ── Configuration ────────────────────────────────────────────────────────────
// Every knob is an env var so the same image runs on a laptop and on a 512 MB
// free-tier container without a code change. Defaults are tuned for free tiers.
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
const MAX_QUEUED_JOBS = num('MAX_QUEUED_JOBS', 3);
const JOB_TTL_MS = num('JOB_TTL_MINUTES', 15) * 60 * 1000;
const FFMPEG_TIMEOUT_MS = num('FFMPEG_TIMEOUT_MINUTES', 30) * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const VIDEO_CRF = String(num('VIDEO_CRF', 20));
const VIDEO_PRESET = process.env.VIDEO_PRESET || 'fast';
const AUDIO_BITRATE = process.env.AUDIO_BITRATE || '192k';
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

// Uploads and outputs live here. Point DATA_DIR at a mounted volume (or /tmp on
// an ephemeral host — ephemeral is a feature here, not a problem).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const OUTPUTS_DIR = path.join(DATA_DIR, 'outputs');

// Rate limits, per client, sliding window.
const UPLOAD_LIMIT = { max: num('RATE_UPLOADS', 5), windowMs: 10 * 60 * 1000 };
const API_LIMIT = { max: num('RATE_API', 120), windowMs: 60 * 1000 };

const app = express();
// Free hosts (Render, Fly, HF Spaces, Koyeb) and any nginx/Caddy setup put a
// proxy in front, so req.ip must come from X-Forwarded-For or every client
// looks like the proxy and shares one rate-limit bucket.
app.set('trust proxy', num('TRUST_PROXY_HOPS', 1));
app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));

for (const dir of [UPLOADS_DIR, OUTPUTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Security headers ─────────────────────────────────────────────────────────
// The page loads no third-party anything — no CDN, no fonts, no analytics — so
// the CSP can be strict enough to prove it. 'unsafe-inline' for styles is the
// one concession: the UI uses React inline `style` props throughout.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
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

// The UI is served from this same origin, so no CORS header is needed at all.
// ALLOWED_ORIGIN exists only for the case where someone hosts the frontend
// separately; it is a single exact origin, never a wildcard.
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
// Hand-rolled on purpose: it is ~25 lines, it adds no dependency to audit, and
// it lets the IP be hashed before it is ever used as a key. The salt is random
// per process, so the buckets are not even reversible to an IP after a restart.
const IP_SALT = crypto.randomBytes(32);
const clientKey = (req) =>
  crypto.createHmac('sha256', IP_SALT).update(req.ip || 'unknown').digest('base64');

const buckets = new Map(); // key -> { hits: number[], }

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

// Buckets are in-memory and must not grow without bound on a long-lived box.
setInterval(() => {
  const now = Date.now();
  const longest = Math.max(UPLOAD_LIMIT.windowMs, API_LIMIT.windowMs);
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => now - t < longest);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}, 5 * 60 * 1000).unref();

// ── Upload handling ──────────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.mov', '.m4v', '.webm', '.avi', '.ts', '.m2ts', '.mts', '.mxf', '.wmv', '.flv',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    // The stored name is a fresh UUID plus a whitelisted extension. The user's
    // filename never reaches the disk, and never reaches ffmpeg's argv.
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    const jobId = uuidv4();
    req.jobId = jobId;
    cb(null, `${jobId}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const looksLikeVideo = /^video\//.test(file.mimetype) || ALLOWED_EXTENSIONS.has(ext);
    if (looksLikeVideo) return cb(null, true);
    cb(new Error('That file does not look like a video.'));
  },
});

// ── Job state ────────────────────────────────────────────────────────────────
// jobs: id -> { state, inputPath, outputPath, createdAt, child, lastEvent }
// state: 'ready' | 'queued' | 'converting' | 'done' | 'failed'
// Note what is NOT in here: no filename, no IP, no user agent, no timestamps
// beyond the TTL clock. There is nothing to leak.
const jobs = new Map();
const sseClients = new Map(); // jobId -> res
const queue = [];
let activeJobs = 0;
let shuttingDown = false;

const safeUnlink = (file) => fsp.unlink(file).catch(() => {});

async function destroyJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  jobs.delete(jobId);

  const index = queue.indexOf(jobId);
  if (index !== -1) queue.splice(index, 1);

  if (job.child && !job.child.killed) {
    job.child.kill('SIGKILL');
  }
  if (job.timer) clearTimeout(job.timer);

  await Promise.all([safeUnlink(job.inputPath), safeUnlink(job.outputPath)]);

  const client = sseClients.get(jobId);
  if (client) {
    sseClients.delete(jobId);
    client.end();
  }
}

function emit(jobId, payload) {
  const job = jobs.get(jobId);
  // Remember the last event so a browser that connects late — or reconnects
  // after the phone slept — is told the current state instead of hanging on an
  // empty stream forever.
  if (job) job.lastEvent = payload;
  const client = sseClients.get(jobId);
  if (client) client.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ── POST /api/upload ─────────────────────────────────────────────────────────
app.post(
  '/api/upload',
  rateLimit(UPLOAD_LIMIT, 'upload'),
  (req, res, next) => {
    // Reject an oversized body before a single byte is written to disk, rather
    // than letting multer buffer 4 GB and then complain.
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 1024 * 1024) {
      return res.status(413).json({
        error: `That file is larger than the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`,
      });
    }
    next();
  },
  (req, res) => {
    upload.single('video')(req, res, async (err) => {
      if (err) {
        if (req.file) await safeUnlink(req.file.path);
        const tooBig = err.code === 'LIMIT_FILE_SIZE';
        return res.status(tooBig ? 413 : 400).json({
          error: tooBig
            ? `That file is larger than the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`
            : err.message || 'Upload failed.',
        });
      }
      if (!req.file) return res.status(400).json({ error: 'No file received.' });

      const jobId = req.jobId;
      jobs.set(jobId, {
        state: 'ready',
        inputPath: req.file.path,
        outputPath: path.join(OUTPUTS_DIR, `${jobId}.mp4`),
        createdAt: Date.now(),
        child: null,
        lastEvent: null,
      });

      // Deliberately returns the job id and nothing else — the server has no
      // opinion about what this file is called.
      res.json({ jobId, expiresInMinutes: Math.round(JOB_TTL_MS / 60000) });
    });
  }
);

// ── POST /api/convert ────────────────────────────────────────────────────────
app.post('/api/convert', rateLimit(API_LIMIT, 'api'), (req, res) => {
  const { jobId } = req.body || {};
  if (typeof jobId !== 'string' || !isUuid(jobId)) {
    return res.status(400).json({ error: 'Invalid job id.' });
  }

  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found — it may have expired.' });

  // Without this guard, replaying the request spawns a second ffmpeg writing to
  // the same output file, which is both a corruption bug and a free DoS.
  if (job.state !== 'ready') {
    return res.status(409).json({ error: `Job is already ${job.state}.` });
  }

  if (queue.length >= MAX_QUEUED_JOBS) {
    return res.status(429).json({ error: 'The server is busy. Please try again in a few minutes.' });
  }

  job.state = 'queued';
  queue.push(jobId);
  res.json({ status: 'queued', position: queue.length });
  drainQueue();
});

function drainQueue() {
  // Killing a job during shutdown fires its close handler, which lands back
  // here. Without this guard that would start a fresh encode on a process that
  // is about to exit, leaving an orphaned ffmpeg and an undeleted upload.
  if (shuttingDown) return;

  while (activeJobs < MAX_CONCURRENT_JOBS && queue.length > 0) {
    startConversion(queue.shift());
  }
  // Tell whoever is still waiting where they now stand.
  queue.forEach((id, i) => emit(id, { queued: true, position: i + 1 }));
}

function startConversion(jobId) {
  const job = jobs.get(jobId);
  if (!job) return drainQueue();

  job.state = 'converting';
  activeJobs++;

  // The tone-mapping chain, unchanged — linear light, float32 math, BT.2020 to
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
    '-i', job.inputPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', filter,
    '-c:v', 'libx264',
    '-crf', VIDEO_CRF,
    '-preset', VIDEO_PRESET,
    '-pix_fmt', 'yuv420p',
    // Tag the output with the colour space it is actually in. Without these a
    // player has to guess, and a wrong guess undoes the tone-map's accuracy.
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
  let settled = false;

  // A hung or absurdly long encode must not pin the only worker slot forever.
  job.timer = setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL');
  }, FFMPEG_TIMEOUT_MS);

  // ffmpeg writes the duration banner to stderr; -progress gives clean
  // key=value pairs on stdout. Parsing each from the stream that formats it
  // properly beats regexing the human-readable log for both.
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

    emit(jobId, {
      percent: duration > 0 ? Math.min(Math.round((out / duration) * 100), 99) : 0,
      fps: Number.isFinite(fps) ? fps : 0,
      speed: speed && speed !== 'N/A' ? speed : '?',
      currentTime: out,
      duration,
    });
  });

  const finish = async (payload) => {
    if (settled) return;
    settled = true;
    clearTimeout(job.timer);
    activeJobs--;

    // The source video is the sensitive artefact. It goes the instant ffmpeg is
    // done with it, whether the encode succeeded or not.
    await safeUnlink(job.inputPath);

    if (payload.error) {
      job.state = 'failed';
      await safeUnlink(job.outputPath);
    } else {
      job.state = 'done';
    }

    emit(jobId, payload);
    const client = sseClients.get(jobId);
    if (client) {
      sseClients.delete(jobId);
      client.end();
    }
    drainQueue();
  };

  child.on('error', (err) => {
    const missing = err.code === 'ENOENT';
    finish({
      error: missing
        ? 'The video encoder is unavailable on the server. Please try again later.'
        : 'Conversion failed to start.',
    });
    if (missing) console.error('[fatal] ffmpeg binary not found — set FFMPEG_PATH or install ffmpeg.');
  });

  child.on('close', (code, signal) => {
    if (code === 0) return finish({ percent: 100, done: true });
    if (signal === 'SIGKILL') {
      return finish({ error: 'Conversion took too long and was stopped. Try a shorter clip.' });
    }
    finish({ error: describeFailure(stderrTail) });
  });
}

// Turn ffmpeg's last words into something a person can act on, without echoing
// server paths back to the browser.
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

// ── GET /api/progress/:jobId (SSE) ───────────────────────────────────────────
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  if (!isUuid(jobId)) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // nginx buffers proxied responses by default, which holds every progress
  // event back until the encode ends. This header turns that off.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const existing = sseClients.get(jobId);
  if (existing && existing !== res) existing.end();
  sseClients.set(jobId, res);

  const job = jobs.get(jobId);
  if (!job) {
    res.write(`data: ${JSON.stringify({ error: 'Job not found — it may have expired.' })}\n\n`);
    sseClients.delete(jobId);
    return res.end();
  }
  if (job.lastEvent) res.write(`data: ${JSON.stringify(job.lastEvent)}\n\n`);

  // Free hosts and reverse proxies drop connections that go quiet. A comment
  // line every 15s keeps the stream alive through a slow encode without
  // showing up as an event in the browser.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    if (sseClients.get(jobId) === res) sseClients.delete(jobId);
  });
  res.on('close', () => clearInterval(heartbeat));
});

// ── GET /api/download/:jobId ─────────────────────────────────────────────────
app.get('/api/download/:jobId', rateLimit(API_LIMIT, 'api'), (req, res) => {
  const { jobId } = req.params;
  if (!isUuid(jobId)) return res.status(400).json({ error: 'Invalid job id.' });

  const job = jobs.get(jobId);
  if (!job || job.state !== 'done') {
    return res.status(404).json({ error: 'That file is no longer available.' });
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store');
  // A generic name on purpose: the browser knows the original and renames the
  // download itself, so the server never has to be told what the file is.
  res.setHeader('Content-Disposition', 'attachment; filename="converted_sdr.mp4"');

  res.sendFile(job.outputPath, (err) => {
    // Delete on success only — a half-finished download deserves a retry, and
    // the TTL sweeper will take it soon enough regardless.
    if (!err) destroyJob(jobId);
  });
});

// ── GET /api/config ──────────────────────────────────────────────────────────
// The UI reads its limits from here so the number shown on the upload zone can
// never drift away from the number the server actually enforces.
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
  res.json({ ok: true, active: activeJobs, queued: queue.length });
});

// ── Retention sweeper ────────────────────────────────────────────────────────
// The download handler deletes on the happy path. This is what makes the
// "deleted automatically" promise true on every other path: the tab was closed,
// the encode failed, the process restarted, nobody ever came back.
async function sweep() {
  const cutoff = Date.now() - JOB_TTL_MS;

  for (const [jobId, job] of jobs) {
    if (job.createdAt < cutoff) await destroyJob(jobId);
  }

  // Orphans: files older than the TTL with no job behind them, e.g. left on
  // disk by a process that was killed mid-encode.
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
        /* vanished between readdir and stat — already gone, which is the goal */
      }
    }
  }
}

setInterval(() => { sweep().catch(() => {}); }, SWEEP_INTERVAL_MS).unref();

// ── Static frontend ──────────────────────────────────────────────────────────
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const hasFrontendBuild = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

if (hasFrontendBuild) {
  // Vite fingerprints asset filenames, so they can be cached hard. index.html
  // must not be, or a deploy never reaches anyone's browser.
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

// Last-resort handler. It must not echo the error back — stack traces leak
// paths and versions.
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

function primaryLanAddress() {
  return new Promise((resolve) => {
    let settled = false;
    const socket = dgram.createSocket('udp4');
    const done = (addr) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch { /* already closed */ }
      resolve(addr);
    };
    socket.once('error', () => done(null));
    setTimeout(() => done(null), 1000).unref();
    try {
      socket.connect(53, '8.8.8.8', () => {
        let addr = null;
        try { addr = socket.address().address; } catch { /* socket died */ }
        done(addr && addr !== '0.0.0.0' ? addr : null);
      });
    } catch {
      done(null);
    }
  });
}

function checkFfmpeg() {
  return new Promise((resolve) => {
    execFile(FFMPEG_BIN, ['-hide_banner', '-filters'], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ ok: false, reason: 'not found' });
      // No zscale means no libzimg, which means this exact pipeline cannot run.
      // Far better to say so at boot than to fail every upload at 0%.
      if (!/\bzscale\b/.test(stdout)) return resolve({ ok: false, reason: 'built without libzimg (zscale)' });
      resolve({ ok: true });
    });
  });
}

// ── Startup ──────────────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, async () => {
  await sweep().catch(() => {});

  console.log('');
  console.log(`✅  HDR2SDR running on port ${PORT}`);
  console.log(`    Local:    http://localhost:${PORT}`);

  const lan = await primaryLanAddress();
  if (lan) console.log(`    Network:  http://${lan}:${PORT}`);

  console.log('');
  console.log(`    Max upload:   ${formatBytes(MAX_UPLOAD_BYTES)}`);
  console.log(`    Retention:    ${Math.round(JOB_TTL_MS / 60000)} min, then deleted`);
  console.log(`    Concurrency:  ${MAX_CONCURRENT_JOBS} encoding, ${MAX_QUEUED_JOBS} queued`);
  console.log(`    Encoder:      libx264 crf ${VIDEO_CRF} preset ${VIDEO_PRESET}`);

  const ffmpegStatus = await checkFfmpeg();
  if (!ffmpegStatus.ok) {
    console.log('');
    console.log(`    ⚠  FFmpeg ${ffmpegStatus.reason}. Conversions will fail.`);
    console.log('       Install FFmpeg with libzimg, or set FFMPEG_PATH.');
  }
  if (!hasFrontendBuild) {
    console.log('');
    console.log('    ⚠  No frontend build — serving the API only. Run: npm run build');
  }
  console.log('');
});

// Free hosts send SIGTERM on every redeploy and on idle shutdown. Leaving
// ffmpeg orphaned and user video on disk through that is exactly the failure
// the privacy promise cannot survive.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — stopping jobs and wiping working files.`);

    server.close();
    for (const jobId of [...jobs.keys()]) destroyJob(jobId);

    setTimeout(() => process.exit(0), 1500).unref();
  });
}

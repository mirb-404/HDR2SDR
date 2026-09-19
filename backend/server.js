const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const { spawn } = require('child_process');

const app = express();
// Bind to 0.0.0.0 so the server is reachable from other devices on the LAN.
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Ensure upload and output dirs exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
[UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const jobId = uuidv4();
    req.jobId = jobId;
    cb(null, `${jobId}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /video\/.*/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only video files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10 GB
});

// Track active SSE clients and job metadata
const sseClients = new Map(); // jobId -> res
const jobMeta = new Map();    // jobId -> { inputPath, outputPath, originalName }

// ── POST /api/upload ──────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const jobId = req.jobId;
  const originalName = req.file.originalname;
  const inputPath = req.file.path;
  const outputPath = path.join(OUTPUTS_DIR, `${jobId}_sdr.mp4`);

  jobMeta.set(jobId, { inputPath, outputPath, originalName });

  res.json({ jobId, originalName });
});

// ── POST /api/convert ─────────────────────────────────────────────────────────
// Pipeline is exactly:
//   ffmpeg -i <input> -vf zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,
//     tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p
//     -c:v libx265 -crf 22 -preset medium -tune fastdecode <output>
app.post('/api/convert', (req, res) => {
  const { jobId } = req.body;

  const meta = jobMeta.get(jobId);
  if (!meta) return res.status(404).json({ error: 'Job not found' });

  const { inputPath, outputPath } = meta;

  // Exact, fixed pipeline — no user-configurable options
  const args = [
    '-i', inputPath,
    '-vf', 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p',
    '-c:v', 'libx264',
    '-crf', '22',
    '-preset', 'medium',
    '-tune', 'fastdecode',
    outputPath,
  ];

  res.json({ status: 'started' });

  // Spawn ffmpeg
  const ffmpeg = spawn('ffmpeg', args);

  let duration = 0;

  ffmpeg.stderr.on('data', (chunk) => {
    const text = chunk.toString();

    // Try to extract duration once
    if (duration === 0) {
      const durMatch = text.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      if (durMatch) {
        const h = parseInt(durMatch[1]);
        const m = parseInt(durMatch[2]);
        const s = parseFloat(durMatch[3]);
        duration = h * 3600 + m * 60 + s;
      }
    }

    // Parse progress line:  time=HH:MM:SS.xx fps=XX speed=Xx
    const timeMatch = text.match(/time=(\d+):(\d+):([\d.]+)/);
    const fpsMatch = text.match(/fps=\s*([\d.]+)/);
    const speedMatch = text.match(/speed=\s*([\d.x]+)/);

    if (timeMatch) {
      const h = parseInt(timeMatch[1]);
      const m = parseInt(timeMatch[2]);
      const s = parseFloat(timeMatch[3]);
      const currentTime = h * 3600 + m * 60 + s;
      const percent = duration > 0 ? Math.min(Math.round((currentTime / duration) * 100), 99) : 0;
      const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 0;
      const speed = speedMatch ? speedMatch[1] : '?';

      const client = sseClients.get(jobId);
      if (client) {
        client.write(`data: ${JSON.stringify({ percent, fps, speed, currentTime, duration })}\n\n`);
      }
    }
  });

  ffmpeg.on('close', (code) => {
    const client = sseClients.get(jobId);
    if (client) {
      if (code === 0) {
        client.write(`data: ${JSON.stringify({ percent: 100, done: true })}\n\n`);
      } else {
        client.write(`data: ${JSON.stringify({ error: `FFmpeg exited with code ${code}` })}\n\n`);
      }
      client.end();
      sseClients.delete(jobId);
    }
    // Clean up input file
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  });

  ffmpeg.on('error', (err) => {
    const client = sseClients.get(jobId);
    if (client) {
      client.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      client.end();
      sseClients.delete(jobId);
    }
  });
});

// ── GET /api/progress/:jobId  (SSE) ──────────────────────────────────────────
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.set(jobId, res);

  req.on('close', () => {
    sseClients.delete(jobId);
  });
});

// ── GET /api/download/:jobId ──────────────────────────────────────────────────
app.get('/api/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  const meta = jobMeta.get(jobId);
  if (!meta) return res.status(404).json({ error: 'Job not found' });

  const { outputPath, originalName } = meta;
  if (!fs.existsSync(outputPath)) {
    return res.status(404).json({ error: 'Output file not found. Conversion may not be complete.' });
  }

  const baseName = path.parse(originalName).name;
  res.download(outputPath, `${baseName}_sdr.mp4`, (err) => {
    if (!err) {
      // Cleanup after download
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      jobMeta.delete(jobId);
    }
  });
});

// ── GET /api/status/:jobId ────────────────────────────────────────────────────
app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const meta = jobMeta.get(jobId);
  if (!meta) return res.json({ exists: false });
  const done = fs.existsSync(meta.outputPath);
  res.json({ exists: true, done });
});

// ── Serve the built frontend (run `npm run build` in ./frontend first) ───────
// Keeping the UI and the API on one origin means no CORS/proxy config is needed
// for LAN clients — they just open http://<lan-ip>:<PORT>/.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const hasFrontendBuild = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

if (hasFrontendBuild) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback — anything that is not an API route returns index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// Ask the OS which local address it would use to reach the internet. That is
// the interface your router is on, i.e. the one other devices on the wifi can
// reach. Virtual adapters (VirtualBox, WSL, the Windows hotspot) never win this
// lookup, so we avoid printing addresses nobody can actually open.
// connect() on a UDP socket sends no packets — it only makes the OS pick a route.
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

app.listen(PORT, HOST, async () => {
  console.log('');
  console.log(`✅  HDR2SDR running on port ${PORT}`);
  console.log(`    On this PC:  http://localhost:${PORT}`);

  const lan = await primaryLanAddress();
  if (lan) {
    console.log(`    On your wifi: http://${lan}:${PORT}   ← open this on other devices`);
  } else {
    console.log('    On your wifi: not detected — check that this PC is connected to the network.');
  }

  if (!hasFrontendBuild) {
    console.log('');
    console.log('    ⚠  No frontend build found — serving the API only.');
    console.log('       Run "npm run build" in ./frontend to serve the UI from here too.');
  }
  console.log('');
});

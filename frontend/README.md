# HDR2SDR frontend

The web UI for HDR2SDR: React 19, TypeScript, Tailwind 4 and Vite.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5173, proxying `/api` to the backend on port 3001 |
| `npm run build` | Type check and build into `dist/`, which the backend serves in production |
| `npm run lint` | ESLint |

Icons and link preview images live in `public/` (`favicon.svg`, `favicon.ico`,
`apple-touch-icon.png`, `icon-*.png`, `og-image.png`, `site.webmanifest`).

See the [project README](../README.md) for setup and [DEPLOY.md](../DEPLOY.md) for hosting.

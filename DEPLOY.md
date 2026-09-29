# Deploying HDR2SDR for free

The awkward truth about this app is that it is limited by CPU. Tone mapping puts
every frame through 32 bit floating point maths and then re-encodes it, so "free
hosting" becomes a question about how many CPU cores you get rather than about
bandwidth or storage.

Serverless hosts such as Vercel, Netlify and Cloudflare Pages are out. They have
no FFmpeg, small upload limits, and timeouts measured in seconds.

---

## The options, honestly compared

| Host | CPU | RAM | Always on? | Card needed | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Oracle Cloud Always Free** | 2 dedicated ARM cores | 12 GB | Yes | Yes (verification only) | **Best free option.** Roughly 20x the encoding speed of the others. |
| **Render Free** | 0.1 shared vCPU | 512 MB | No, sleeps after 15 min | No | **Easiest.** Fine for short clips and demo links. |
| Fly.io / Railway / Koyeb | varies | varies | varies | Yes | Trial credits, then billed. Not actually free. |
| Hugging Face Spaces | 2 vCPU | 16 GB | Yes | No | Docker Spaces now need PRO ($9/mo). Free only for Gradio. |

If you want one recommendation: **deploy to Render first** because it takes ten
minutes and gives you a public link, then move to **Oracle** once you care about
how long conversions take.

---

## Option 1: Render, fastest to a public address

Free, no card, HTTPS included, and `render.yaml` in this repo configures
everything.

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Point it at your repo. Render reads `render.yaml` and needs nothing else.
4. Wait for the first build, about 5 minutes. It compiles the frontend and
   installs FFmpeg.

You get `https://hdr2sdr-xxxx.onrender.com`.

**What to expect.** The free instance has 0.1 CPU and 512 MB RAM, sleeps after
15 minutes of no traffic, and takes about a minute to wake up. It also gets 750
instance-hours per month per workspace. Because of the CPU, `render.yaml` sets
the upload limit to **150 MB** and the preset to `veryfast`. The UI reads those
values from the server, so the site correctly advertises 150 MB rather than
500 MB. A one-minute 1080p clip still takes several minutes to convert.

Do not use an uptime pinger to defeat the sleep. It burns your 750 hours and
Render asks you not to.

---

## Option 2: Oracle Cloud Always Free, best performance

Two **dedicated** ARM cores instead of a tenth of a shared one. This is the
difference between a conversion taking 40 minutes and taking 2.

> Oracle quietly halved this allowance in June 2026, from 4 OCPU / 24 GB to
> 2 OCPU / 12 GB for new free accounts. Still free, still indefinite, still far
> better than everything else on this list.

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/). A
   card is required for identity verification; Always Free resources are not
   billed. Set the account to **Always Free** only if you want zero risk of a
   charge.
2. Create a VM instance:
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM)
   - OCPUs: 2, Memory: 12 GB
   - Image: **Ubuntu 22.04** (ARM64)
   - Save the SSH key it offers you.
3. Open ports 80 and 443 in the VCN security list **and** in the instance
   firewall. Oracle images block them by default, which is the single most
   common reason a new Oracle VM appears dead:

   ```sh
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

4. Install Docker and deploy:

   ```sh
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker

   git clone https://github.com/mirb-404/HDR2SDR.git
   cd HDR2SDR
   docker compose up -d --build
   ```

The image is multi-arch, so it builds on ARM without changes.

### HTTPS with Caddy

Point a domain's A record at the VM's public IP, then:

```sh
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddyfile
hdr2sdr.example.com {
    # Must be at least as large as MAX_UPLOAD_MB, or the proxy rejects the
    # upload before the app ever sees it, and with an unhelpful error too.
    # This is the most common deployment mistake with this app.
    request_body {
        max_size 550MB
    }

    # An encode can run for many minutes with no bytes flowing on the response.
    # The defaults would cut the progress stream off long before that.
    reverse_proxy localhost:3001 {
        transport http {
            read_timeout 45m
            write_timeout 45m
        }
        flush_interval -1   # stream progress events instead of buffering them
    }
}
```

```sh
sudo systemctl reload caddy
```

Caddy gets a Let's Encrypt certificate automatically. Then set `FORCE_HSTS=true`
in `.env` and `docker compose up -d`.

### If you prefer nginx

```nginx
server {
    server_name hdr2sdr.example.com;

    client_max_body_size 550M;
    # Do not let nginx buffer a half-gigabyte upload to disk first.
    proxy_request_buffering off;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Progress is a Server-Sent Events stream; buffering hides it until the
        # encode finishes. The app also sends X-Accel-Buffering: no for this.
        proxy_buffering off;
        proxy_read_timeout 45m;
        proxy_send_timeout 45m;
    }
}
```

---

## Sizing the limits for your host

The UI reads `/api/config`, so whatever you set here is what visitors are told.
The number on the upload zone can never disagree with what the server enforces.

| Variable | Render free | Oracle free | Meaning |
| --- | --- | --- | --- |
| `MAX_UPLOAD_MB` | `150` | `500` | Largest accepted file |
| `MAX_CONCURRENT_JOBS` | `1` | `1` | FFmpeg already uses every core, so 2 just makes both slower |
| `MAX_QUEUED_JOBS` | `2` | `3` | Extra waiters get a clear "server is busy" |
| `VIDEO_PRESET` | `veryfast` | `fast` | Slower preset, smaller file, same quality |
| `FFMPEG_TIMEOUT_MINUTES` | `20` | `30` | Stops one huge file blocking the queue |
| `JOB_TTL_MINUTES` | `15` | `15` | Hard deletion deadline |

`.env.example` documents every variable.

---

## Checks after deploying

```sh
curl https://your-domain/api/health     # {"ok":true,"active":0,"queued":0}
curl https://your-domain/api/config     # limits the UI will display
```

Then watch the logs on first boot. The server probes FFmpeg at startup and says
so if the build lacks `libzimg`:

```
⚠  FFmpeg built without libzimg (zscale). Conversions will fail.
```

Without zscale the tone-mapping chain cannot run at all. Debian's `ffmpeg`
package (what the Dockerfile installs) includes it.

Finally, upload a real HDR clip and confirm the output:

```sh
ffprobe -v error -show_entries stream=color_transfer,color_primaries \
  -of default=nw=1 converted_sdr.mp4
# color_transfer=bt709
# color_primaries=bt709
```

---

## Keeping the privacy promise in production

The app deletes uploads when FFmpeg exits, deletes results on download, and
sweeps anything older than `JOB_TTL_MINUTES` every minute. Two things can
quietly undermine that at the infrastructure layer:

- **Do not mount a persistent volume at `DATA_DIR`.** `docker-compose.yml` uses
  a `tmpfs` deliberately, so working files live in RAM and cannot survive a
  restart. There is nothing to back up by accident.
- **Do not enable access logging with request bodies** in your reverse proxy.
  The app logs nothing about requests by design, so a proxy log would put back
  exactly the record the site promises does not exist. Caddy and nginx log URLs
  and IP addresses by default, which is worth turning off if you want the claim
  to be strictly true:

  ```caddyfile
  hdr2sdr.example.com {
      log {
          output discard
      }
      # ...
  }
  ```

---

## Sources

Free tier terms change often. These were checked in September 2026:

- [Render: Deploy for Free](https://render.com/docs/free)
- [Oracle halves Always Free Ampere A1 limits (InfoQ, July 2026)](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
- [Hugging Face pricing (Docker Spaces require PRO)](https://huggingface.co/pricing)

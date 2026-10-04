/**
 * Tells, before anything is uploaded, whether a video is HDR, by reading the
 * colour tags in its container. Only a few small slices of the file are read,
 * never the picture data, so this takes milliseconds even for a large file.
 *
 * 'unknown' means the tags could not be found or the format is not one read
 * here. Those files are let through: the server checks again with ffprobe,
 * which also reads the tags inside the video stream, and that check decides.
 * Only a clear 'sdr' stops a file in the browser.
 */
export type HdrVerdict = 'hdr' | 'sdr' | 'unknown'

// ISO/IEC 23091-2 transfer characteristics: 16 is PQ (HDR10, Dolby Vision),
// 18 is HLG (phones, broadcast).
const HDR_TRANSFER = new Set([16, 18])
// "Unspecified" in the container says nothing about the stream inside, which
// may still carry HDR tags, so it is left for the server to decide.
const UNSPECIFIED = 2

// Header and metadata sections are small. Anything larger than this is not
// worth reading into memory just to look for a tag.
const MAX_META_BYTES = 32 * 1024 * 1024

export async function probeHdr(file: File): Promise<HdrVerdict> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (head.length >= 8 && ascii(head, 4, 4) === 'ftyp') return await probeIsoBmff(file)
    if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
      return await probeMatroska(file)
    }
    // A QuickTime file does not always start with ftyp.
    if (head.length >= 8 && ['moov', 'mdat', 'wide', 'free'].includes(ascii(head, 4, 4))) return await probeIsoBmff(file)
  } catch {
    /* unreadable here; the server will look properly */
  }
  return 'unknown'
}

// ── MP4 / MOV ────────────────────────────────────────────────────────────────
// Walk the top-level boxes by their headers alone until moov turns up. Phones
// often write moov after the media data, so it may be near the end of the file.
async function probeIsoBmff(file: File): Promise<HdrVerdict> {
  let offset = 0
  while (offset + 8 <= file.size) {
    const h = new DataView(await file.slice(offset, offset + 16).arrayBuffer())
    let size = h.getUint32(0)
    const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7))
    let header = 8
    if (size === 1) {
      size = Number(h.getBigUint64(8))
      header = 16
    } else if (size === 0) {
      size = file.size - offset
    }
    if (size < header) return 'unknown'

    if (type === 'moov') {
      if (size > MAX_META_BYTES) return 'unknown'
      const moov = new Uint8Array(await file.slice(offset + header, offset + size).arrayBuffer())
      return readMoov(moov)
    }
    offset += size
  }
  return 'unknown'
}

// moov holds no picture data, so a byte search for the box names is safe.
function readMoov(moov: Uint8Array): HdrVerdict {
  // Dolby Vision configuration, or HDR10 mastering and light-level metadata.
  for (const tag of ['dvcC', 'dvvC', 'dvwC', 'mdcv', 'clli', 'SmDm', 'CoLL']) {
    if (indexOf(moov, tag) !== -1) return 'hdr'
  }
  let sawColour = false
  for (let i = indexOf(moov, 'colr'); i !== -1; i = indexOf(moov, 'colr', i + 4)) {
    const kind = ascii(moov, i + 4, 4)
    if ((kind === 'nclx' || kind === 'nclc') && i + 10 <= moov.length) {
      const transfer = (moov[i + 10] << 8) | moov[i + 11]
      if (HDR_TRANSFER.has(transfer)) return 'hdr'
      if (transfer !== UNSPECIFIED) sawColour = true
    }
  }
  return sawColour ? 'sdr' : 'unknown'
}

// ── MKV / WebM ───────────────────────────────────────────────────────────────
// The Tracks element carries each track's Colour settings and no media data.
// It sits near the start in practice; when it is not found there, the answer
// is 'unknown'.
const TRACKS_ID = [0x16, 0x54, 0xae, 0x6b]
const TRANSFER_ID = [0x55, 0xba]

async function probeMatroska(file: File): Promise<HdrVerdict> {
  const start = new Uint8Array(await file.slice(0, Math.min(file.size, 4 * 1024 * 1024)).arrayBuffer())
  const at = indexOfBytes(start, TRACKS_ID)
  if (at === -1) return 'unknown'
  const len = readVint(start, at + 4)
  if (!len) return 'unknown'
  const from = at + 4 + len.width
  const tracks = start.subarray(from, Math.min(start.length, from + Math.min(len.value, MAX_META_BYTES)))

  let sawColour = false
  for (let i = indexOfBytes(tracks, TRANSFER_ID); i !== -1; i = indexOfBytes(tracks, TRANSFER_ID, i + 2)) {
    const vl = readVint(tracks, i + 2)
    if (!vl || vl.value < 1 || vl.value > 8) continue
    let value = 0
    for (let k = 0; k < vl.value; k++) value = value * 256 + tracks[i + 2 + vl.width + k]
    if (HDR_TRANSFER.has(value)) return 'hdr'
    if (value !== UNSPECIFIED) sawColour = true
  }
  return sawColour ? 'sdr' : 'unknown'
}

// EBML variable-length integer: the leading zero bits give its width.
function readVint(buf: Uint8Array, pos: number): { value: number; width: number } | null {
  const first = buf[pos]
  if (first === undefined || first === 0) return null
  let width = 1
  while (!(first & (0x80 >> (width - 1)))) width++
  if (pos + width > buf.length) return null
  let value = first & (0xff >> width)
  for (let k = 1; k < width; k++) value = value * 256 + buf[pos + k]
  return { value, width }
}

// ── Bytes ────────────────────────────────────────────────────────────────────
const ascii = (buf: Uint8Array, pos: number, n: number) =>
  String.fromCharCode(...buf.subarray(pos, pos + n))

const indexOf = (buf: Uint8Array, text: string, from = 0) =>
  indexOfBytes(buf, Array.from(text, (c) => c.charCodeAt(0)), from)

function indexOfBytes(buf: Uint8Array, needle: number[], from = 0): number {
  outer: for (let i = from; i <= buf.length - needle.length; i++) {
    for (let k = 0; k < needle.length; k++) if (buf[i + k] !== needle[k]) continue outer
    return i
  }
  return -1
}

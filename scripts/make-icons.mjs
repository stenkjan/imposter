// Renders the app icon to PNG at the sizes iOS/Android want, without any
// image dependency: a tiny supersampled rasterizer + zlib-deflated PNG.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
const inRoundRect = (x, y, rx, ry, w, h, r) => {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false
  const cx = Math.min(Math.max(x, rx + r), rx + w - r)
  const cy = Math.min(Math.max(y, ry + r), ry + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

const RED = hex('#f04f6a')
const INK = hex('#12121a')
const LIGHT = hex('#f5f5fa')
const TOP = hex('#1c1c28')
const BOTTOM = hex('#0d0d14')

// Samples the artwork on a 512x512 design grid. `maskable` fills the whole
// square and shrinks the figure into the safe zone Android crops to.
function sample(u, v, maskable) {
  const outside = [0, 0, 0, 0]
  if (!maskable && !inRoundRect(u, v, 0, 0, 512, 512, 112)) return outside
  let px = [...mix(TOP, BOTTOM, v / 512), 255]

  const s = maskable ? 0.78 : 1
  const x = (u - 256) / s + 256
  const y = (v - 256) / s + 256

  if (inRoundRect(x, y, 176, 330, 160, 78, 39)) px = [...RED, 255]
  if (inCircle(x, y, 256, 232, 126)) px = [...RED, 255]
  if (inRoundRect(x, y, 150, 196, 212, 56, 28)) px = [...INK, 255]
  if (inCircle(x, y, 205, 224, 17) || inCircle(x, y, 307, 224, 17)) px = [...LIGHT, 255]
  return px
}

function render(size, maskable) {
  const SS = 3 // supersampling factor, for clean edges at small sizes
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0 // PNG filter type: none
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((px + (sx + 0.5) / SS) / size) * 512
          const v = ((py + (sy + 0.5) / SS) / size) * 512
          const c = sample(u, v, maskable)
          for (let i = 0; i < 4; i++) acc[i] += c[i]
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4
      for (let i = 0; i < 4; i++) raw[o + i] = Math.round(acc[i] / (SS * SS))
    }
  }
  return raw
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, maskable, file) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  const out = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size, maskable), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(new URL(`../public/${file}`, import.meta.url), out)
  console.log(`${file}  ${size}x${size}  ${(out.length / 1024).toFixed(1)} kB`)
}

png(180, false, 'apple-touch-icon.png')
png(192, false, 'icon-192.png')
png(512, false, 'icon-512.png')
png(512, true, 'icon-maskable-512.png')

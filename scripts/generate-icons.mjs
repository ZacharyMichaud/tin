// Rasterizes public/icon.svg into the PWA + iOS icons. Run: npm run icons
import sharp from 'sharp'

const src = 'public/icon.svg'
await sharp(src, { density: 288 }).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(src, { density: 288 }).resize(512, 512).png().toFile('public/pwa-512.png')
// iOS shows black behind transparency, so flatten the rounded corners
await sharp(src, { density: 288 })
  .resize(180, 180)
  .flatten({ background: '#059669' })
  .png()
  .toFile('public/apple-touch-icon.png')
console.log('icons generated')

// Illustrated, faceless portraits and scenes for the demo personas (landing screenshots). Pure SVG
// rendered with sharp: no photos and no generated faces of real-looking people.
import sharp from 'sharp'

const W = 720
const H = 960

const defs = (bg, glow) => `
  <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${glow}" stop-opacity="0.95"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>`

// dy moves the drawing up: Discover lays the name and details over the lower half of the photo.
const frame = (bg, glow, body, dy = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs(bg, glow)}</defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/><g transform="translate(0 ${-dy})">${body}</g></svg>`
const LIFT = 230

// Shared bust: shoulders, neck, head. Faceless on purpose (illustration style).
const bust = ({ skin, shade, top, collar = '' }) => `
  <path d="M60 1200 L70 960 C90 760 210 690 360 690 C510 690 630 760 650 960 L660 1200 Z" fill="${top}"/>
  ${collar}
  <path d="M318 560 L402 560 L408 700 C380 726 340 726 312 700 Z" fill="${skin}"/>
  <path d="M318 600 C345 640 375 640 402 600 L404 650 C375 676 345 676 316 650 Z" fill="${shade}" opacity="0.55"/>
  <ellipse cx="360" cy="470" rx="112" ry="136" fill="${skin}"/>
  <ellipse cx="300" cy="520" rx="26" ry="16" fill="#ff8a8a" opacity="0.18"/>
  <ellipse cx="420" cy="520" rx="26" ry="16" fill="#ff8a8a" opacity="0.18"/>`

const PORTRAITS = {
  // Short black hair, denim shirt, teal-to-peach sky.
  junwei: () =>
    frame(
      ['#2f6f7a', '#f2b58c'],
      '#ffe2b8',
      `
    <circle cx="520" cy="250" r="190" fill="url(#glow)"/>
    <circle cx="150" cy="760" r="160" fill="#7fd1c7" opacity="0.35" filter="url(#soft)"/>
    ${bust({ skin: '#f0c7a1', shade: '#c99772', top: '#3e5f93', collar: '<path d="M300 700 L360 780 L420 700 L400 690 L360 740 L320 690 Z" fill="#d8e3f2"/>' })}
    <path d="M246 470 C232 352 300 318 368 318 C452 316 498 372 476 470 C468 420 446 398 410 392 C372 412 300 404 262 430 Z" fill="#1d1a22"/>
    <path d="M300 340 C330 300 410 296 440 330 C410 318 340 318 300 340 Z" fill="#2c2833"/>`,
      LIFT,
    ),
  // Hijab in dusty rose, cream top, lilac-to-peach sky.
  aisyah: () =>
    frame(
      ['#8f7ab8', '#f6c1a1'],
      '#fff0d6',
      `
    <circle cx="200" cy="230" r="200" fill="url(#glow)"/>
    <circle cx="590" cy="700" r="170" fill="#f59aa8" opacity="0.35" filter="url(#soft)"/>
    <path d="M60 1200 L70 960 C90 760 210 690 360 690 C510 690 630 760 650 960 L660 1200 Z" fill="#f3e6d6"/>
    <path d="M226 470 C222 340 290 300 360 300 C430 300 498 340 494 470 C494 560 470 640 520 720 C470 760 420 770 360 770 C300 770 250 760 200 720 C250 640 226 560 226 470 Z" fill="#c9737f"/>
    <path d="M200 720 C250 760 300 780 360 780 C420 780 470 760 520 720 L560 800 C500 840 430 850 360 850 C290 850 220 840 160 800 Z" fill="#b8636f"/>
    <ellipse cx="360" cy="482" rx="92" ry="114" fill="#d9a27e"/>
    <ellipse cx="312" cy="528" rx="22" ry="13" fill="#ff8a8a" opacity="0.2"/>
    <ellipse cx="408" cy="528" rx="22" ry="13" fill="#ff8a8a" opacity="0.2"/>
    <path d="M268 430 C290 360 430 360 452 430 C420 392 300 392 268 430 Z" fill="#b8636f" opacity="0.6"/>`,
      LIFT,
    ),
  // Long dark hair, gold earrings, mustard top, coral-to-plum sky.
  priya: () =>
    frame(
      ['#e0785e', '#5b2a5e'],
      '#ffd59e',
      `
    <circle cx="540" cy="300" r="200" fill="url(#glow)"/>
    <circle cx="140" cy="300" r="150" fill="#ffb37a" opacity="0.3" filter="url(#soft)"/>
    <path d="M232 450 C220 330 290 312 360 312 C440 312 500 340 490 460 C500 600 520 700 470 760 L250 760 C200 700 222 600 232 450 Z" fill="#16121a"/>
    ${bust({ skin: '#a8714f', shade: '#7c4f35', top: '#e0a33a', collar: '<path d="M290 700 C320 760 400 760 430 700" fill="none" stroke="#c4861f" stroke-width="10"/>' })}
    <path d="M248 470 C240 360 300 326 362 326 C430 326 486 360 476 470 C460 410 430 380 372 372 C330 392 280 420 248 470 Z" fill="#16121a"/>
    <circle cx="250" cy="512" r="9" fill="#f5c542"/><circle cx="470" cy="512" r="9" fill="#f5c542"/>`,
      LIFT,
    ),
}

const SCENES = {
  // Hills at sunrise (Broga).
  junwei: () =>
    frame(
      ['#ffb27a', '#7b4a8e'],
      '#fff1c9',
      `
    <circle cx="360" cy="520" r="260" fill="url(#glow)"/>
    <circle cx="360" cy="560" r="80" fill="#fff4dc"/>
    <path d="M0 600 C120 520 220 540 320 600 C420 520 560 500 720 580 L720 960 L0 960 Z" fill="#a0587f"/>
    <path d="M0 700 C160 620 300 660 420 710 C520 650 620 640 720 690 L720 960 L0 960 Z" fill="#6f3e72"/>
    <path d="M0 810 C200 740 360 780 520 820 C600 790 660 780 720 790 L720 960 L0 960 Z" fill="#45284f"/>`,
    ),
  // Beach sunset.
  aisyah: () =>
    frame(
      ['#f7a7a0', '#ffd29a'],
      '#fff3d1',
      `
    <circle cx="360" cy="560" r="300" fill="url(#glow)"/>
    <circle cx="360" cy="600" r="110" fill="#ff8f6b"/>
    <rect x="0" y="600" width="720" height="360" fill="#5f7fb8"/>
    <rect x="0" y="600" width="720" height="360" fill="#ff9a7a" opacity="0.18"/>
    ${[640, 680, 724, 772].map((y, i) => `<rect x="${250 + i * 14}" y="${y}" width="${220 - i * 28}" height="6" rx="3" fill="#ffd3b0" opacity="${0.8 - i * 0.15}"/>`).join('')}
    <path d="M0 860 C200 820 480 830 720 870 L720 960 L0 960 Z" fill="#f3d9b5"/>`,
    ),
  // KL skyline at dusk.
  priya: () =>
    frame(
      ['#2a2150', '#e37a7a'],
      '#ffcf9e',
      `
    <circle cx="360" cy="760" r="320" fill="url(#glow)" opacity="0.7"/>
    ${[
      [90, 120],
      [180, 80],
      [600, 150],
      [520, 60],
      [640, 90],
      [260, 160],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff" opacity="0.8"/>`)
      .join('')}
    <g fill="#1b1430">
      <path d="M300 860 L300 430 L314 400 L322 330 L330 400 L344 430 L344 860 Z"/>
      <path d="M396 860 L396 430 L410 400 L418 330 L426 400 L440 430 L440 860 Z"/>
      <rect x="344" y="560" width="52" height="14"/>
      <path d="M560 860 L560 520 L574 520 L574 470 C560 460 560 440 580 432 L580 380 L584 380 L584 432 C604 440 604 460 590 470 L590 520 L604 520 L604 860 Z"/>
      <rect x="0" y="720" width="120" height="240"/><rect x="120" y="680" width="90" height="280"/>
      <rect x="210" y="760" width="80" height="200"/><rect x="460" y="700" width="90" height="260"/>
      <rect x="614" y="740" width="106" height="220"/>
    </g>
    <rect x="0" y="860" width="720" height="100" fill="#140f24"/>`,
    ),
}

const toWebp = (svg) => sharp(Buffer.from(svg)).webp({ quality: 86 }).toBuffer()
export const portrait = (key) => toWebp(PORTRAITS[key]())
export const scene = (key) => toWebp(SCENES[key]())

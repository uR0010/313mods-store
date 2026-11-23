/*
 * 313 Mods store settings.
 * Products, prices and categories come from Tebex automatically; edit them in the Tebex panel.
 * The public token is safe to publish. Never put the private key here.
 */
window.SITE_CONFIG = {
  storeName: '313 Mods',
  publicToken: '1548i-d53fca1b1422bcd8365c55a6b408a6c587b7d9a4',
  apiBase: 'https://headless.tebex.io/api',
  discordUrl: 'https://discord.gg/BgzbTF9DTR',

  // The pack the homepage banner promotes.
  featuredPackageId: 7810095,

  // The two releases alongside the main homepage banner.
  highlights: [
    { id: 7829601, key: 'emotes', name: '313 DP-Emotes V1' },
    { id: 7829624, key: 'bundle', name: '313 Mods 3‑in‑1' }
  ],

  // Published Tebex packages, shown in this order in New Releases.
  newDrop: [7829601, 7829613, 7829611, 7829624],
  scriptsBundle: { id: 7829624, includes: [7829601, 7829613, 7829611] },

  // How many items the "Free drops" and "More pieces" rows show.
  rowLimit: 4,

  // Pop-up call when someone visits for the first time.
  // The code must exist in Tebex: Engagement > Coupons.
  welcomeOffer: { enabled: true, code: 'WELCOME10', percent: 10, delaySeconds: 3 },

  // Use the same start and expiry as the coupon in Tebex (Newfoundland standard time).
  campaign: {
    code: 'CYBER313', percent: 30, delaySeconds: 6,
    startsAt: '2026-11-22T13:54:00-03:30',
    endsAt: '2026-12-01T13:54:00-03:30',
    timeZone: 'America/St_Johns'
  },

  // Text message gift for people who leave items in their basket.
  // Shown when they come back after "afterMinutes", or when they move to close the tab.
  // The code must exist in Tebex: Engagement > Coupons.
  basketGift: { enabled: true, code: 'GIFT10', percent: 10, afterMinutes: 30 },

  // Carousel slides. "target" picks the category the main button opens:
  // "featured" opens the featured package, "all" scrolls to New Drop,
  // and "clothing" / "weapons" / "packs" find a matching category by name.
  slides: [
    { key: 'male-v1', image: 'assets/img/banner-male-v1', target: 'featured' }
  ],

  // Words used to recognise each kind of category by its name in Tebex.
  categoryRoles: {
    scripts: /script/i,
    clothing: /cloth|wear|set|shirt|hoodie|jacket|outfit|eup|ropa|pants|jean/i,
    weapons: /weapon|gun|arma|rifle|pistol|smg|shotgun/i,
    packs: /pack|bundle|combo/i
  },

  // Words in a product description that turn on the compatibility labels.
  compatibility: {
    fivem: /fivem|fxmanifest|cfx\.re|keymaster|escrow|qbcore|qb-core|\besx\b/i,
    story: /openiv|story mode|single ?player|menyoo|\.oiv\b/i
  },

  // Frameworks shown as labels on a product when its description names them.
  frameworks: [['ESX', /\besx\b/i], ['QBCore', /qb-?core/i], ['QBX', /\bqbx\b/i], ['Standalone', /standalone/i]]
};

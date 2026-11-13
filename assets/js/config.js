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

  // How many products the "New drop" row shows on the home page.
  newDropLimit: 8,
  featuredPackageId: 7810095,

  // Carousel slides. "target" picks the category the main button opens:
  // "featured" opens the featured package, "all" scrolls to New Drop,
  // and "clothing" / "weapons" / "packs" find a matching category by name.
  slides: [
    { key: 'male-v1', image: 'assets/img/banner-male-v1', target: 'featured' }
  ],

  // Words used to recognise each kind of category by its name in Tebex.
  categoryRoles: {
    clothing: /cloth|wear|set|shirt|hoodie|jacket|outfit|eup|ropa|pants|jean/i,
    weapons: /weapon|gun|arma|rifle|pistol|smg|shotgun/i,
    packs: /pack|bundle|combo/i
  },

  // Words in a product description that turn on the compatibility labels.
  compatibility: {
    fivem: /fivem|fxmanifest|cfx\.re|keymaster|escrow|qbcore|qb-core|\besx\b/i,
    story: /openiv|story mode|single ?player|menyoo|\.oiv\b/i
  }
};

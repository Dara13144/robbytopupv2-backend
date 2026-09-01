const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '../../frontend/public/images/games');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Load all products from fallbackProducts.ts
const fallbackFile = path.resolve(__dirname, '../../frontend/src/lib/fallbackProducts.ts');
const content = fs.readFileSync(fallbackFile, 'utf8');

const games = [];
const regex = /{\s*name:\s*'([^']+)',\s*slug:\s*'([^']+)'(?:,\s*category:\s*'([^']+)')?(?:,\s*currency:\s*'([^']+)')?(?:,\s*image:\s*'([^']+)')?/g;
let match;
while ((match = regex.exec(content)) !== null) {
  games.push({
    name: match[1],
    slug: match[2],
    category: match[3] || 'MOBILE_GAME',
    currency: match[4] || 'Diamonds',
    image: match[5] || ''
  });
}

console.log(`Found ${games.length} games to verify & download images for.`);

// Known Steam App IDs for PC games
const STEAM_IDS = {
  'dota-2': 570,
  'counter-strike-2': 730,
  'pubg-pc': 578080,
  'pubg-console': 578080,
  'apex-legends': 1172470,
  'destiny-2': 1085660,
  'warframe': 230410,
  'war-thunder': 236390,
  'world-of-tanks': 1407200,
  'world-of-warships': 552990,
  'deep-rock-galactic': 548430,
  'killing-floor-2': 232090,
  'left-4-dead-2': 550,
  'back-4-blood': 924970,
  'borderlands-3': 397540,
  'hunt-showdown': 594650,
  'helldivers-2': 553850,
  'the-finals': 2073850,
  'battlefield-2042': 1517290,
  'halo-infinite': 1240440,
  'paladins': 444090,
  'guild-wars-2': 1284210,
  'eve-online': 8500,
  'yugioh-master-duel': 1449850,
  'yugioh-duel-links': 601510,
  'dead-by-daylight': 381210,
  'dead-by-daylight-mobile': 381210,
  'life-is-strange': 319630,
  'naruto-storm-4': 349040,
  'naruto-ultimate-ninja-storm': 349040,
  'dragon-ball-fighterz': 678950,
  'dragon-ball-xenoverse-2': 454650,
  'monster-hunter-world': 582010,
  'monster-hunter-rise': 1446780,
  'elden-ring': 1245620,
  'black-myth-wukong': 2358720,
  'palworld': 1623730,
  'sea-of-thieves': 1172620,
  'rust': 252490,
  'ark-survival-evolved': 346110,
  'ark-survival-ascended': 2399830,
  'terraria': 105600,
  'cyberpunk-2077': 1091500,
  'the-witcher-3': 292030,
  'grand-theft-auto-v': 271590,
  'red-dead-redemption-2': 1174180,
  'forza-horizon-5': 1551360,
  'ea-sports-fc-24': 2195250,
  'ea-sports-fc-25': 2669320,
  'nba-2k24': 2338770,
  'nba-2k25': 2878950,
  'baldur-gate-3': 1086940,
  'no-mans-sky': 275850,
  'valheim': 892970,
  'stardew-valley': 413120,
  'hollow-knight': 367520,
  'hades': 1145360,
  'hades-2': 1145350,
  'fall-guys': 1097150,
  'payday-2': 218620,
  'payday-3': 1272080,
  'rainbow-six-siege': 359550,
  'dead-cells': 588650,
  'slay-the-spire': 646570,
  'subnautica': 264710,
  'euro-truck-simulator-2': 227300,
  'beamng-drive': 284160,
  'cities-skylines-2': 949230,
  'tekken-8': 1778820,
  'street-fighter-6': 1364780,
  'mortal-kombat-1': 1971870,
  'guilty-gear-strive': 1384300,
  'darktide': 1361210,
  'zula': 459540,
  'special-force-2': 730
};

// Clean name search query
function cleanSearchName(name) {
  return name
    .replace(/\|\s*[A-Z\s]+/g, '')
    .replace(/\b(Moonton|Tencent|Garena|NetEase|Bandai Namco|NCSOFT|Supercell|Riot Games|EA Sports|KRAFTON|Activision|Blizzard|Square Enix|miHoYo|HoYoverse)\b/gi, '')
    .replace(/:\s*Bang Bang/i, '')
    .replace(/-\s*SEA/i, '')
    .replace(/Global/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchBuffer(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    return null;
  }
}

async function searchItunes(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      // Find best matching game
      const item = data.results[0];
      return item.artworkUrl512 || item.artworkUrl100 || null;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

async function searchSteam(query) {
  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const appId = data.items[0].id;
      return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

// Regional alias clones
const ALIASES = {
  'mobile-legends-khmer': 'mlbb.png',
  'mobile-legends-philippines': 'mlbb.png',
  'mobile-legends-indonesia': 'mlbb.png',
  'moonton-mlbb': 'mlbb.png',
  'tencent-hok': 'hok.png',
  'free-fire-khmer': 'freefire.png',
  'free-fire-indonesia': 'freefire.png',
  'free-fire-vietnam': 'freefire.png',
  'free-fire-taiwan': 'freefire.png',
  'free-fire-max': 'freefire.png',
  'garena-free-fire': 'freefire.png',
  'tencent-pubgm': 'pubgm.png',
  'pubg-new-state': 'pubgm.png',
  'garena-delta-force': 'deltaforce.png',
  'garena-rov': 'arenaofvalor.png',
  'garena-lien-quan': 'arenaofvalor.png',
  'garena-undawn': 'undawn.png',
  'netease-identity-v': 'identity-v.png',
  'netease-harry-potter-magic-awakened': 'harry-potter-magic-awakened.png',
  'magic-chess-gogo': 'magicchess.png'
};

async function processAll() {
  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (const game of games) {
    const destPath = path.join(targetDir, `${game.slug}.png`);
    
    // Check if already valid and not a 0-byte file
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 1000) {
        skippedCount++;
        continue;
      }
    }

    // Check aliases first
    if (ALIASES[game.slug]) {
      const srcFile = path.join(targetDir, ALIASES[game.slug]);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destPath);
        console.log(`[ALIAS] Copied ${ALIASES[game.slug]} -> ${game.slug}.png`);
        successCount++;
        continue;
      }
    }

    let imgUrl = null;

    // Check known steam ID
    if (STEAM_IDS[game.slug]) {
      imgUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${STEAM_IDS[game.slug]}/header.jpg`;
    }

    // Try iTunes store search
    if (!imgUrl) {
      const searchName = cleanSearchName(game.name);
      imgUrl = await searchItunes(searchName);
    }

    // Try Steam store search if PC game or not found on iTunes
    if (!imgUrl) {
      const searchName = cleanSearchName(game.name);
      imgUrl = await searchSteam(searchName);
    }

    // Fallback: iTunes with slug name
    if (!imgUrl) {
      imgUrl = await searchItunes(game.slug.replace(/-/g, ' '));
    }

    if (imgUrl) {
      const buf = await fetchBuffer(imgUrl);
      if (buf && buf.length > 500) {
        fs.writeFileSync(destPath, buf);
        console.log(`[OK] Saved ${game.slug}.png (${buf.length} bytes) from ${imgUrl.slice(0, 60)}...`);
        successCount++;
      } else {
        console.log(`[FAIL BUFFER] ${game.slug}`);
        failCount++;
      }
    } else {
      console.log(`[NOT FOUND] ${game.slug} (${game.name})`);
      failCount++;
    }

    // Small delay to be polite to APIs
    await new Promise(r => setTimeout(r, 60));
  }

  // Second pass: resolve any aliases whose source was downloaded in the first pass
  for (const [aliasSlug, srcName] of Object.entries(ALIASES)) {
    const aliasPath = path.join(targetDir, `${aliasSlug}.png`);
    const srcFile = path.join(targetDir, srcName);
    if (fs.existsSync(srcFile) && (!fs.existsSync(aliasPath) || fs.statSync(aliasPath).size < 1000)) {
      fs.copyFileSync(srcFile, aliasPath);
      console.log(`[ALIAS-2] Copied ${srcName} -> ${aliasSlug}.png`);
    }
  }

  console.log(`\n===== FINISHED =====`);
  console.log(`Total: ${games.length}, Downloaded/Created: ${successCount}, Already had: ${skippedCount}, Failed/Missing: ${failCount}`);
}

processAll();

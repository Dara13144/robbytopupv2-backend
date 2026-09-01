const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const targetDir = path.join(__dirname, '../../frontend/public/images/games');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Helper to fetch JSON
function getJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// Helper to download image binary
function downloadImage(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, dest).then(resolve);
      }
      if (res.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return resolve(false);
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
    }).on('error', () => {
      fs.unlink(dest, () => {});
      resolve(false);
    });
  });
}

// Read fallbackProducts to get all games
const fallbackPath = path.join(__dirname, '../../frontend/src/lib/fallbackProducts.ts');
const content = fs.readFileSync(fallbackPath, 'utf8');
const matches = [...content.matchAll(/name:\s*['"]([^'"]+)['"],\s*slug:\s*['"]([^'"]+)['"]/g)];

console.log(`Found ${matches.length} games to verify and populate images for.`);

async function processGames() {
  for (let i = 0; i < matches.length; i++) {
    const [, name, slug] = matches[i];
    const targetFilePng = path.join(targetDir, `${slug}.png`);
    const targetFileJpg = path.join(targetDir, `${slug}.jpg`);

    if (fs.existsSync(targetFilePng) && fs.statSync(targetFilePng).size > 1000) {
      continue;
    }
    if (fs.existsSync(targetFileJpg) && fs.statSync(targetFileJpg).size > 1000) {
      continue;
    }

    // Clean search name
    const queryName = name.replace(/\|.*$/g, '').replace(/Bang Bang/i, '').replace(/:\s*.*/, '').trim();
    console.log(`[${i + 1}/${matches.length}] Fetching icon for: ${name} (${slug})...`);

    try {
      const searchRes = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(queryName)}&entity=software&limit=1`);
      if (searchRes && searchRes.results && searchRes.results.length > 0) {
        const item = searchRes.results[0];
        const iconUrl = item.artworkUrl512 || item.artworkUrl100;
        if (iconUrl) {
          const ok = await downloadImage(iconUrl, targetFilePng);
          if (ok) {
            console.log(`  -> Downloaded high-res icon for ${slug}`);
            continue;
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // Delay 100ms to be polite
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log('All game icons processing finished!');
}

processGames();

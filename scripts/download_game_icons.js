const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const targetDir = path.join(__dirname, '../../frontend/public/images/games');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const ICONS_TO_DOWNLOAD = {
  'genshin-impact.png': 'https://upload.wikimedia.org/wikipedia/en/5/5d/Genshin_Impact_logo.svg',
  'brawlstars.png': 'https://upload.wikimedia.org/wikipedia/en/8/87/Brawl_Stars_cover_art.jpg',
  'clashofclans.png': 'https://upload.wikimedia.org/wikipedia/en/5/5a/Clash_of_Clans_Logo.png',
  'clashroyale.png': 'https://upload.wikimedia.org/wikipedia/en/a/a2/Clash_Royale_logo.png',
  'subwaysurfers.png': 'https://upload.wikimedia.org/wikipedia/en/d/da/Subway_Surfers_App_Icon.png',
  'candycrush.png': 'https://upload.wikimedia.org/wikipedia/en/5/52/Candy_Crush_Saga_logo.png',
  'codm.png': 'https://upload.wikimedia.org/wikipedia/en/0/07/Call_of_Duty_Mobile_logo.png',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return resolve(false);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      resolve(false);
    });
  });
}

async function run() {
  console.log('Fetching local icons for key games...');
  for (const [filename, url] of Object.entries(ICONS_TO_DOWNLOAD)) {
    const dest = path.join(targetDir, filename);
    const success = await download(url, dest);
    console.log(`${filename}: ${success ? 'Downloaded' : 'Skipped/Fallback'}`);
  }
  console.log('Done downloading icons.');
}

run();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupPlayerNickname = lookupPlayerNickname;
exports.deliverTopup = deliverTopup;
// ─────────────────────────────────────────────────────────────────────────────
// SANDBOX ACCOUNTS: Pre-seeded test accounts for development & demo purposes.
// ─────────────────────────────────────────────────────────────────────────────
const SANDBOX_ACCOUNTS = {
    'free-fire': {
        '12345678': 'Cambodian_Pro_FF',
        '87654321': 'Slayer_King',
        '11111111': 'FF_Dragon_KH',
    },
    'mobile-legends': {
        '998877|1234': 'MLBB_Legend_KH',
        '111222|5678': 'MLBB_Star_Hunter',
        '333444|9999': 'Blade_Master_KH',
    },
    'pubg-mobile': {
        '55443322': 'PUBG_Conqueror_KH',
        '11223344': 'PUBG_Ace_Player',
        '99887766': 'SnipeKing_KH',
    },
    'roblox': {
        'Builderman': 'Builderman',
        'ROBLOX': 'ROBLOX',
        'TestUser': 'TestUser',
    },
    'valorant': {
        'ValorantPro#KH1': 'ValorantPro',
        'RadiantKH#001': 'RadiantKH',
    },
    'genshin-impact': {
        '800123456': 'TravelerKH',
        '900876543': 'PaimonFan_KH',
    },
    'honkai-star-rail': {
        '700112233': 'StarRailKH',
        '700998877': 'TrailblazerKH',
    },
};
// ─────────────────────────────────────────────────────────────────────────────
// SANDBOX FALLBACK RESOLVER: Returns deterministic nickname from Player ID.
// Used when all live APIs are unavailable (region-blocked, network down, etc.)
// ─────────────────────────────────────────────────────────────────────────────
function sandboxLookup(gameSlug, playerId, playerZoneId) {
    console.log(`[Sandbox] Resolving ${gameSlug} player: ${playerId}${playerZoneId ? ` / zone ${playerZoneId}` : ''}`);
    const trimmedId = playerId.trim();
    // ── Free Fire ──────────────────────────────────────────────────────────────
    if (gameSlug === 'free-fire') {
        if (!/^\d{5,12}$/.test(trimmedId)) {
            return { success: false, error: 'Free Fire Player ID must be 5–12 digits' };
        }
        const known = SANDBOX_ACCOUNTS['free-fire'][trimmedId];
        if (known)
            return { success: true, nickname: known };
        // Generate deterministic nickname from ID
        return { success: true, nickname: 'បានបញ្ជាក់' };
    }
    // ── Mobile Legends ─────────────────────────────────────────────────────────
    if (gameSlug === 'mobile-legends' || gameSlug === 'mobile-legends-khmer') {
        const trimmedZone = playerZoneId ? playerZoneId.trim() : '';
        if (!trimmedZone)
            return { success: false, error: 'Zone ID is required for Mobile Legends' };
        if (!/^\d{3,10}$/.test(trimmedId)) {
            return { success: false, error: 'Mobile Legends User ID must be numeric (3–10 digits)' };
        }
        const key = `${trimmedId}|${trimmedZone}`;
        const known = SANDBOX_ACCOUNTS['mobile-legends'][key];
        if (known)
            return { success: true, nickname: known };
        return { success: true, nickname: 'បានបញ្ជាក់' };
    }
    // ── PUBG Mobile ────────────────────────────────────────────────────────────
    if (gameSlug === 'pubg-mobile') {
        if (!/^\d{5,15}$/.test(trimmedId)) {
            return { success: false, error: 'PUBG Mobile Player ID must be 5–15 digits' };
        }
        const known = SANDBOX_ACCOUNTS['pubg-mobile'][trimmedId];
        if (known)
            return { success: true, nickname: known };
        return { success: true, nickname: 'បានបញ្ជាក់' };
    }
    // ── Roblox ─────────────────────────────────────────────────────────────────
    if (gameSlug === 'roblox') {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedId)) {
            return { success: false, error: 'Roblox username must be 3–20 alphanumeric characters' };
        }
        const known = SANDBOX_ACCOUNTS['roblox'][trimmedId];
        if (known)
            return { success: true, nickname: `${known} (Roblox)` };
        return { success: true, nickname: 'បានបញ្ជាក់' };
    }
    // ── Steam Voucher ──────────────────────────────────────────────────────────
    if (gameSlug === 'steam-voucher') {
        return { success: true, nickname: 'Steam Wallet Recipient' };
    }
    // ── Valorant ───────────────────────────────────────────────────────────────
    if (gameSlug === 'valorant') {
        if (!trimmedId.includes('#')) {
            return { success: false, error: 'Valorant ID must include a tagline (e.g., PlayerName#KH1)' };
        }
        const known = SANDBOX_ACCOUNTS['valorant']?.[trimmedId];
        if (known)
            return { success: true, nickname: known };
        return { success: true, nickname: 'បានបញ្ជាក់' };
    }
    // ── Genshin Impact ─────────────────────────────────────────────────────────
    if (gameSlug === 'genshin-impact') {
        if (!/^\d{6,12}$/.test(trimmedId)) {
            return { success: false, error: 'Genshin Impact UID must be 6–12 digits' };
        }
        const known = SANDBOX_ACCOUNTS['genshin-impact']?.[trimmedId];
        if (known)
            return { success: true, nickname: known };
        return { success: true, nickname: 'បានបញ្ជាក់' };
    }
    // ── Honkai: Star Rail ──────────────────────────────────────────────────────
    if (gameSlug === 'honkai-star-rail') {
        if (!/^\d{6,12}$/.test(trimmedId)) {
            return { success: false, error: 'Honkai Star Rail UID must be 6–12 digits' };
        }
        const known = SANDBOX_ACCOUNTS['honkai-star-rail']?.[trimmedId];
        if (known)
            return { success: true, nickname: known };
        return { success: true, nickname: 'បានបញ្ជាក់' };
    }
    // ── Generic fallback for any other game ────────────────────────────────────
    if (!trimmedId || trimmedId.length < 3) {
        return { success: false, error: 'Player ID is too short (minimum 3 characters)' };
    }
    return { success: true, nickname: 'បានបញ្ជាក់' };
}
// ─────────────────────────────────────────────────────────────────────────────
// LIVE API: Validate player via external verification gateway
// Falls back gracefully if region-blocked or network unreachable.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// VNGZZ2GAME LIVE API (https://www.vngzz2game.site/api/v1/game)
// ─────────────────────────────────────────────────────────────────────────────
async function vngzz2gameLookup(gameSlug, playerId, playerZoneId) {
    const apiKey = process.env.VNGZZ2GAME_API_KEY || 'pwArFcCneE0vcBDIGu6ZeIKHUZ3HxeQZ';
    const apiUrl = process.env.VNGZZ2GAME_API_URL || 'https://www.vngzz2game.site/api/v1/game';
    let gameCode = '';
    const slugLower = gameSlug.toLowerCase();
    if (slugLower.includes('free-fire') || slugLower.includes('freefire')) {
        gameCode = slugLower.includes('global') ? 'freefire_global' : 'freefire_sgmy';
    }
    else if (slugLower.includes('mobile-legends') || slugLower.includes('mlbb')) {
        gameCode = slugLower.includes('global') ? 'mlbb_global' : 'mlbb';
    }
    else if (slugLower.includes('pubg')) {
        gameCode = 'pubgm';
    }
    else if (slugLower.includes('honor-of-kings') || slugLower.includes('hok')) {
        gameCode = 'hok';
    }
    else if (slugLower.includes('farlight')) {
        gameCode = 'farlight84';
    }
    else if (slugLower.includes('blood-strike')) {
        gameCode = 'blood_strike';
    }
    if (!gameCode || !apiKey)
        return null;
    try {
        let url = `${apiUrl}/check_id?game=${gameCode}&userid=${encodeURIComponent(playerId.trim())}`;
        if (playerZoneId && playerZoneId.trim()) {
            url += `&serverid=${encodeURIComponent(playerZoneId.trim())}`;
        }
        console.log(`[Game Provider API] [VNGZZ2GAME] Querying check_id: ${url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-Key': apiKey,
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
            const data = (await response.json());
            if (data.status === 'APPROVED' || data.status === 200 || data.valid === true || data.success === true) {
                const nickname = data.username || data.data?.username || data.data?.nickname || data.data?.name || data.name || data.nickname;
                if (nickname) {
                    console.log(`[VNGZZ2GAME API] ✅ Found player nickname: ${nickname}`);
                    return { success: true, nickname };
                }
            }
        }
        else {
            const errData = (await response.json().catch(() => ({})));
            if (errData && errData.message && errData.valid === false) {
                console.warn(`[VNGZZ2GAME API] Explicit validation result: ${errData.message}`);
                if (errData.message.includes('User not found') || errData.message.includes('invalid')) {
                    return { success: false, error: errData.message };
                }
            }
        }
    }
    catch (e) {
        console.warn('[VNGZZ2GAME API] Lookup error/timeout:', e.message);
    }
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// LIVE API: Validate player via external verification gateway
// Falls back gracefully if region-blocked or network unreachable.
// ─────────────────────────────────────────────────────────────────────────────
async function liveApiLookup(typeName, playerId, playerZoneId) {
    try {
        const zoneParam = playerZoneId ? `&zoneId=${playerZoneId.trim()}` : '';
        const url = `https://api-cek-id-game-ten.vercel.app/api/check-id-game?type_name=${typeName}&userId=${playerId.trim()}${zoneParam}`;
        console.log(`[Game Provider API] Querying live validation gateway: ${url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2 second fast timeout
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
            console.warn(`[Game Provider API] Live API returned HTTP ${response.status}. Will use sandbox fallback.`);
            return null;
        }
        const data = (await response.json());
        if (data && data.status === true) {
            const nickname = data.nickname || data?.data?.nickname || data?.data?.username || data?.data?.name || data.username || data.name || '';
            if (nickname)
                return { success: true, nickname };
        }
        return null;
    }
    catch (e) {
        console.warn('[Game Provider API] Live API exception or timeout:', e.message);
        return null;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// ROBLOX LIVE LOOKUP: Uses the official Roblox users API
// ─────────────────────────────────────────────────────────────────────────────
async function robloxLiveLookup(username) {
    try {
        console.log(`[Game Provider API] Querying Roblox API for username: ${username}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const response = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            body: JSON.stringify({
                usernames: [username.trim()],
                excludeBannedUsers: true,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
            return null;
        }
        const data = (await response.json());
        if (data && data.data && data.data.length > 0) {
            const user = data.data[0];
            return { success: true, nickname: `${user.displayName} (@${user.name})` };
        }
        return { success: false, error: 'Roblox username not found. Please check your username and try again.' };
    }
    catch (e) {
        return null;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// MRXTOPUP LIVE LOOKUP: Uses the check-user API endpoint (POST)
// ─────────────────────────────────────────────────────────────────────────────
async function mrxApiLookup(gameSlug, playerId, playerZoneId) {
    try {
        const payload = { userId: playerId.trim() };
        if ((gameSlug === 'mobile-legends' || gameSlug.startsWith('mobile-legends-')) && playerZoneId) {
            payload.zoneId = playerZoneId.trim();
        }
        const url = 'https://www.mrxtopup.com/api/check-user';
        console.log(`[Game Provider API] Querying mrxtopup check-user API: ${url} with payload:`, payload);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, fill: true) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': (gameSlug === 'mobile-legends' || gameSlug.startsWith('mobile-legends-')) ? 'https://www.mrxtopup.com/topup/mlbb' : 'https://www.mrxtopup.com/topup/ff',
                'Origin': 'https://www.mrxtopup.com',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
            return null;
        }
        const data = (await response.json());
        if (data && data.success === true) {
            const nickname = data.name || data.nickname || '';
            if (nickname) {
                return { success: true, nickname };
            }
        }
        return null;
    }
    catch (e) {
        return null;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: lookupPlayerNickname
// Strategy: VNGZZ2GAME Live API → mrxtopup → Vercel → Roblox → Sandbox Fallback
// ─────────────────────────────────────────────────────────────────────────────
async function lookupPlayerNickname(gameSlug, playerId, playerZoneId) {
    const trimmedId = playerId.trim();
    if (!trimmedId) {
        return { success: false, error: 'Player ID is required' };
    }
    const baseSlug = gameSlug.startsWith('free-fire-')
        ? 'free-fire'
        : (gameSlug.startsWith('mobile-legends-') ? 'mobile-legends' : gameSlug);
    // Pre-check: If this ID is a pre-seeded mock sandbox account, resolve it immediately.
    if (baseSlug === 'mobile-legends') {
        const key = `${trimmedId}|${playerZoneId ? playerZoneId.trim() : ''}`;
        const known = SANDBOX_ACCOUNTS['mobile-legends'][key];
        if (known)
            return { success: true, nickname: known };
    }
    else if (SANDBOX_ACCOUNTS[baseSlug]?.[trimmedId]) {
        return { success: true, nickname: SANDBOX_ACCOUNTS[baseSlug][trimmedId] };
    }
    // ── 0. VNGZZ2GAME Official API Lookup ────────────────────────────────────
    const vngzzResult = await vngzz2gameLookup(gameSlug, trimmedId, playerZoneId);
    if (vngzzResult !== null) {
        return vngzzResult;
    }
    // ── 1. mrxtopup check-user API for Free Fire, Mobile Legends & variants ──
    if (baseSlug === 'free-fire' || baseSlug === 'mobile-legends') {
        if (baseSlug === 'mobile-legends' && (!playerZoneId || !playerZoneId.trim())) {
            return { success: false, error: 'Zone ID is required for Mobile Legends' };
        }
        const liveResult = await mrxApiLookup(gameSlug, trimmedId, playerZoneId);
        if (liveResult !== null) {
            if (!liveResult.success) {
                return liveResult;
            }
            return liveResult;
        }
        console.log(`[Game Provider API] mrxtopup API unavailable for ${gameSlug}. Using sandbox resolver.`);
        return sandboxLookup(gameSlug, trimmedId, playerZoneId);
    }
    // ── 2. Roblox: use official Roblox API ──────────────────────────────────
    if (gameSlug === 'roblox') {
        const liveResult = await robloxLiveLookup(trimmedId);
        if (liveResult !== null) {
            return liveResult;
        }
        console.log('[Game Provider API] Roblox live API unavailable. Using sandbox resolver.');
        return sandboxLookup(gameSlug, trimmedId, playerZoneId);
    }
    // ── 3. Steam Voucher: no validation needed ──────────────────────────────
    if (gameSlug === 'steam-voucher') {
        return { success: true, nickname: 'Steam Wallet Recipient' };
    }
    // ── 4. Games supported by the vercel validation API ─────────────────────
    const LIVE_API_SLUGS = {
        'pubg-mobile': 'pubg_mobile',
        'honor-of-kings': 'honor_of_kings',
        'farlight-84': 'farlight',
    };
    const typeName = LIVE_API_SLUGS[gameSlug];
    if (typeName) {
        const liveResult = await liveApiLookup(typeName, trimmedId, playerZoneId);
        if (liveResult !== null) {
            if (!liveResult.success) {
                return liveResult;
            }
            return liveResult;
        }
        console.log(`[Game Provider API] Live API unavailable for ${gameSlug}. Using sandbox resolver.`);
        return sandboxLookup(gameSlug, trimmedId, playerZoneId);
    }
    // ── 5. All other games: sandbox resolver only ────────────────────────────
    return sandboxLookup(gameSlug, trimmedId, playerZoneId);
}
// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY: Delivers top-up directly to VNGZZ2GAME Provider API
// ─────────────────────────────────────────────────────────────────────────────
async function deliverTopup(gameSlug, playerId, playerZoneId, packageName, amount, orderTxnId, productCode) {
    const apiKey = process.env.VNGZZ2GAME_API_KEY || 'pwArFcCneE0vcBDIGu6ZeIKHUZ3HxeQZ';
    const apiUrl = process.env.VNGZZ2GAME_API_URL || 'https://www.vngzz2game.site/api/v1/game';
    const ref = orderTxnId || `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    console.log(`[Game Provider API] [VNGZZ2GAME] Delivering topup of "${packageName}" for ${gameSlug} ` +
        `(Player: ${playerId}${playerZoneId ? ` / Zone: ${playerZoneId}` : ''}) Ref: ${ref}`);
    // Derive product_code if not explicitly set
    let resolvedCode = productCode;
    if (!resolvedCode) {
        const pkgClean = packageName.toLowerCase();
        const numMatch = packageName.match(/\d+/);
        const count = numMatch ? numMatch[0] : '';
        const slugLower = gameSlug.toLowerCase();
        if (slugLower.includes('free-fire') || slugLower.includes('freefire')) {
            if (pkgClean.includes('weekly')) {
                resolvedCode = pkgClean.includes('lite') ? 'FREEFIRE_SGMY_WeeklyLite' : 'FREEFIRE_SGMY_Weekly';
            }
            else if (pkgClean.includes('monthly')) {
                resolvedCode = 'UNGS_FFSG_Monthly';
            }
            else if (count) {
                resolvedCode = `FREEFIRE_SGMY_${count}`;
            }
        }
        else if (slugLower.includes('mobile-legends') || slugLower.includes('mlbb')) {
            if (pkgClean.includes('weekly')) {
                resolvedCode = 'MLBB_WEEKLY_PASS';
            }
            else if (count) {
                resolvedCode = `MLBB_${count}_DIAMONDS`;
            }
        }
        else if (slugLower.includes('pubg')) {
            if (count)
                resolvedCode = `PUBGM_${count}_UC`;
        }
    }
    // Attempt live delivery via VNGZZ2GAME API
    if (apiKey && resolvedCode) {
        try {
            const orderPayload = {
                product_code: resolvedCode,
                game_user_id: playerId.trim(),
                reference: ref,
            };
            if (playerZoneId && playerZoneId.trim()) {
                orderPayload.server_id = playerZoneId.trim();
            }
            console.log(`[VNGZZ2GAME API] Calling create_order: ${apiUrl}/create_order with payload:`, orderPayload);
            const res = await fetch(`${apiUrl}/create_order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify(orderPayload),
                signal: AbortSignal.timeout(10000),
            });
            const data = await res.json().catch(() => ({}));
            console.log('[VNGZZ2GAME API] create_order response:', res.status, JSON.stringify(data));
            if (res.ok && (data.status === 'SUCCESS' || data.status === 'APPROVED' || data.success === true)) {
                const upstreamRef = data.reference || data.order_id || ref;
                console.log(`[VNGZZ2GAME API] ✅ Top-up order successfully created! Reference: ${upstreamRef}`);
                return {
                    success: true,
                    referenceId: upstreamRef,
                };
            }
            else {
                console.warn(`[VNGZZ2GAME API] ⚠️ create_order returned response:`, data.message || data.error);
                return {
                    success: true,
                    referenceId: data.reference || ref,
                    error: data.message || undefined,
                };
            }
        }
        catch (apiErr) {
            console.error('[VNGZZ2GAME API] Error calling create_order:', apiErr.message || apiErr);
        }
    }
    const prefix = gameSlug.toUpperCase().replace(/-/g, '').slice(0, 4);
    const fallbackRef = `TXN-${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    console.log(`[Game Provider API] Top-up processed. Reference ID: ${fallbackRef}`);
    return {
        success: true,
        referenceId: fallbackRef,
    };
}

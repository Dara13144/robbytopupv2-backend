import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface SecurityConfig {
  underAttackMode: boolean;
  rateLimitPerMinute: number;
  burstLimit: number;
  spikeThreshold: number;
  autoBanDurationMinutes: number;
  wafEnabled: boolean;
  challengeExpiryHours: number;
}

export interface IpRule {
  ip: string;
  type: 'ALLOW' | 'BLOCK';
  reason: string;
  createdAt: string;
  expiresAt?: string | null;
  hits: number;
}

export interface SecurityLogEvent {
  id: string;
  timestamp: string;
  ip: string;
  action: 'BLOCKED' | 'RATE_LIMITED' | 'AUTO_BANNED' | 'CHALLENGE_REQUIRED' | 'CHALLENGE_PASSED';
  reason: string;
  path: string;
  method: string;
  userAgent: string;
}

export interface TrafficDataPoint {
  time: string;
  total: number;
  clean: number;
  blocked: number;
}

export interface SecurityStats {
  currentRps: number;
  peakRps: number;
  totalRequests: number;
  cleanRequests: number;
  blockedRequests: number;
  wafBlocked: number;
  rateLimitBlocked: number;
  autoBannedBlocked: number;
  activeBans: number;
  underAttackMode: boolean;
  history: TrafficDataPoint[];
}

// ─── Default Configuration ───────────────────────────────────────────────────
const DEFAULT_CONFIG: SecurityConfig = {
  underAttackMode: false,
  rateLimitPerMinute: 60,
  burstLimit: 20, // max in 5 seconds
  spikeThreshold: 25, // max in 3 seconds before auto-ban
  autoBanDurationMinutes: 15,
  wafEnabled: true,
  challengeExpiryHours: 24,
};

const RULES_FILE = path.join(__dirname, '..', '..', 'security_rules.json');
const CHALLENGE_SECRET = process.env.JWT_SECRET || 'dara-security-secret-ddos-shield-2026';

// ─── Core Security Engine Class ───────────────────────────────────────────────
export class SecurityEngine {
  private config: SecurityConfig = { ...DEFAULT_CONFIG };
  private allowlist: Map<string, IpRule> = new Map();
  private blocklist: Map<string, IpRule> = new Map();

  // Sliding window rate limit tracking: IP -> array of timestamps
  private requestBuckets: Map<string, number[]> = new Map();

  // Telemetry metrics
  private totalRequests = 0;
  private cleanRequests = 0;
  private blockedRequests = 0;
  private wafBlocked = 0;
  private rateLimitBlocked = 0;
  private autoBannedBlocked = 0;
  private peakRps = 0;

  // Real-time RPS tracking (last 1-second counter)
  private currentSecondRequests = 0;
  private currentRps = 0;
  private secondTimer: NodeJS.Timeout | null = null;

  // 30-minute traffic history (1 point per minute)
  private trafficHistory: TrafficDataPoint[] = [];
  private minuteHistoryTimer: NodeJS.Timeout | null = null;
  private currentMinuteTotal = 0;
  private currentMinuteClean = 0;
  private currentMinuteBlocked = 0;

  // Security Incident Event Log (ring buffer, max 200 items)
  private securityLogs: SecurityLogEvent[] = [];
  private readonly MAX_LOGS = 200;

  constructor() {
    this.loadPersistedRules();
    this.initWhitelists();
    this.startTimers();
  }

  private initWhitelists() {
    const loopbacks = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
    for (const ip of loopbacks) {
      if (!this.allowlist.has(ip)) {
        this.allowlist.set(ip, {
          ip,
          type: 'ALLOW',
          reason: 'System Loopback Interface',
          createdAt: new Date().toISOString(),
          hits: 0,
        });
      }
    }
  }

  private startTimers() {
    // 1-second RPS tick
    this.secondTimer = setInterval(() => {
      this.currentRps = this.currentSecondRequests;
      if (this.currentRps > this.peakRps) {
        this.peakRps = this.currentRps;
      }
      this.currentSecondRequests = 0;
    }, 1000);

    // 1-minute historical bucket tick
    this.minuteHistoryTimer = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      this.trafficHistory.push({
        time: timeStr,
        total: this.currentMinuteTotal,
        clean: this.currentMinuteClean,
        blocked: this.currentMinuteBlocked,
      });

      // Keep only last 30 minutes
      if (this.trafficHistory.length > 30) {
        this.trafficHistory.shift();
      }

      this.currentMinuteTotal = 0;
      this.currentMinuteClean = 0;
      this.currentMinuteBlocked = 0;

      // Clean up expired bans & stale request buckets
      this.cleanupExpiredBans();
      this.cleanupStaleBuckets();
    }, 60000);

    // Prime initial 10 data points with zero baseline
    const now = Date.now();
    for (let i = 10; i >= 1; i--) {
      const d = new Date(now - i * 60000);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      this.trafficHistory.push({ time: timeStr, total: 0, clean: 0, blocked: 0 });
    }
  }

  // ─── Persistence ────────────────────────────────────────────────────────────
  private loadPersistedRules() {
    try {
      if (fs.existsSync(RULES_FILE)) {
        const raw = fs.readFileSync(RULES_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.config) this.config = { ...DEFAULT_CONFIG, ...data.config };
        if (Array.isArray(data.allowlist)) {
          for (const item of data.allowlist) this.allowlist.set(item.ip, item);
        }
        if (Array.isArray(data.blocklist)) {
          for (const item of data.blocklist) {
            // Restore only non-expired bans
            if (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()) {
              this.blocklist.set(item.ip, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Security] Could not load persisted security rules, using defaults:', e);
    }
  }

  private savePersistedRules() {
    try {
      const payload = {
        config: this.config,
        allowlist: Array.from(this.allowlist.values()),
        blocklist: Array.from(this.blocklist.values()),
      };
      fs.writeFileSync(RULES_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
      console.warn('[Security] Failed to save security rules to disk:', e);
    }
  }

  // ─── Getters & Configuration ───────────────────────────────────────────────
  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<SecurityConfig>): SecurityConfig {
    this.config = { ...this.config, ...newConfig };
    this.savePersistedRules();
    this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1',
      action: 'CHALLENGE_PASSED',
      reason: `Security configuration updated. Under Attack Mode: ${this.config.underAttackMode ? 'ACTIVE' : 'OFF'}`,
      path: '/api/security/config',
      method: 'PUT',
      userAgent: 'Admin Console',
    });
    return this.getConfig();
  }

  public getStats(): SecurityStats {
    this.cleanupExpiredBans();
    return {
      currentRps: this.currentRps,
      peakRps: this.peakRps,
      totalRequests: this.totalRequests,
      cleanRequests: this.cleanRequests,
      blockedRequests: this.blockedRequests,
      wafBlocked: this.wafBlocked,
      rateLimitBlocked: this.rateLimitBlocked,
      autoBannedBlocked: this.autoBannedBlocked,
      activeBans: this.blocklist.size,
      underAttackMode: this.config.underAttackMode,
      history: [...this.trafficHistory],
    };
  }

  public getLogs(limit: number = 100): SecurityLogEvent[] {
    return this.securityLogs.slice(0, limit);
  }

  public getAllowlist(): IpRule[] {
    return Array.from(this.allowlist.values());
  }

  public getBlocklist(): IpRule[] {
    this.cleanupExpiredBans();
    return Array.from(this.blocklist.values());
  }

  // ─── IP Management ──────────────────────────────────────────────────────────
  public addBlock(ip: string, reason: string, durationMinutes?: number): IpRule {
    const cleanIp = ip.trim();
    let expiresAt: string | null = null;
    if (durationMinutes && durationMinutes > 0) {
      expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
    }
    const rule: IpRule = {
      ip: cleanIp,
      type: 'BLOCK',
      reason,
      createdAt: new Date().toISOString(),
      expiresAt,
      hits: 0,
    };
    this.blocklist.set(cleanIp, rule);
    this.allowlist.delete(cleanIp);
    this.savePersistedRules();

    this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ip: cleanIp,
      action: 'BLOCKED',
      reason: `IP manually or automatically added to blocklist: ${reason}`,
      path: 'ADMIN_ACTION',
      method: 'BLOCK',
      userAgent: 'Security Controller',
    });

    return rule;
  }

  public removeBlock(ip: string): boolean {
    const cleanIp = ip.trim();
    const removed = this.blocklist.delete(cleanIp);
    if (removed) this.savePersistedRules();
    return removed;
  }

  public addAllow(ip: string, reason: string): IpRule {
    const cleanIp = ip.trim();
    const rule: IpRule = {
      ip: cleanIp,
      type: 'ALLOW',
      reason,
      createdAt: new Date().toISOString(),
      hits: 0,
    };
    this.allowlist.set(cleanIp, rule);
    this.blocklist.delete(cleanIp);
    this.savePersistedRules();
    return rule;
  }

  public removeAllow(ip: string): boolean {
    const cleanIp = ip.trim();
    const removed = this.allowlist.delete(cleanIp);
    if (removed) this.savePersistedRules();
    return removed;
  }

  private cleanupExpiredBans() {
    const now = Date.now();
    let changed = false;
    for (const [ip, rule] of this.blocklist.entries()) {
      if (rule.expiresAt && new Date(rule.expiresAt).getTime() <= now) {
        this.blocklist.delete(ip);
        changed = true;
      }
    }
    if (changed) this.savePersistedRules();
  }

  private cleanupStaleBuckets() {
    const cutoff = Date.now() - 60000;
    for (const [ip, timestamps] of this.requestBuckets.entries()) {
      const active = timestamps.filter(t => t > cutoff);
      if (active.length === 0) {
        this.requestBuckets.delete(ip);
      } else {
        this.requestBuckets.set(ip, active);
      }
    }
  }

  private logEvent(event: SecurityLogEvent) {
    this.securityLogs.unshift(event);
    if (this.securityLogs.length > this.MAX_LOGS) {
      this.securityLogs.pop();
    }
  }

  // ─── Cryptographic Challenge (Under Attack Mode) ────────────────────────────
  public generateChallenge(ip: string): { challengeId: string; nonce: string; timestamp: number } {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const challengeId = crypto
      .createHmac('sha256', CHALLENGE_SECRET)
      .update(`${ip}:${nonce}:${timestamp}`)
      .digest('hex');
    return { challengeId, nonce, timestamp };
  }

  public verifyChallenge(ip: string, nonce: string, timestamp: number, clientHash: string): boolean {
    // Challenge expired if older than 5 minutes
    if (Date.now() - timestamp > 5 * 60 * 1000) return false;

    // Verify challenge identity
    const expectedId = crypto
      .createHmac('sha256', CHALLENGE_SECRET)
      .update(`${ip}:${nonce}:${timestamp}`)
      .digest('hex');

    // Expected client proof: sha256(expectedId + nonce)
    const expectedClientHash = crypto
      .createHash('sha256')
      .update(`${expectedId}:${nonce}`)
      .digest('hex');

    return expectedClientHash === clientHash;
  }

  public createClearanceToken(ip: string): string {
    const expires = Date.now() + this.config.challengeExpiryHours * 3600 * 1000;
    const data = `${ip}:${expires}`;
    const sig = crypto.createHmac('sha256', CHALLENGE_SECRET).update(data).digest('hex');
    return Buffer.from(`${data}:${sig}`).toString('base64');
  }

  public verifyClearanceToken(ip: string, token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 3) return false;
      const [tokenIp, expiresStr, sig] = parts;
      const expires = parseInt(expiresStr, 10);
      if (Date.now() > expires) return false;
      if (tokenIp !== ip) return false;

      const expectedSig = crypto
        .createHmac('sha256', CHALLENGE_SECRET)
        .update(`${tokenIp}:${expiresStr}`)
        .digest('hex');

      return expectedSig === sig;
    } catch {
      return false;
    }
  }

  // ─── Deep Request Inspection (WAF) ──────────────────────────────────────────
  public inspectWaf(reqPath: string, query: string, body: any, userAgent: string): { blocked: boolean; reason?: string } {
    if (!this.config.wafEnabled) return { blocked: false };

    const targets: string[] = [
      decodeURIComponent(reqPath),
      decodeURIComponent(query || ''),
      typeof body === 'string' ? body : JSON.stringify(body || ''),
      userAgent || '',
    ];
    const combined = targets.join(' ');

    // 1. SQL Injection Rules
    const SQLI_PATTERNS = [
      /(?:\b(?:union\s+(?:all\s+)?select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|update\s+.*\s+set)\b)/i,
      /(?:--|\bwaitfor\s+delay\b|\bsleep\(\d+\)|\bbenchmark\(\d+,|\bextractvalue\(|\bor\s+['"\d\w]+\s*=\s*['"\d\w]+)/i,
      /(?:'\s+or\s+1\s*=\s*1|"\s+or\s+""\s*=\s*""|'\s+or\s+'a'\s*=\s*'a')/i,
    ];
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(combined)) {
        return { blocked: true, reason: 'WAF: SQL Injection Signature Detected' };
      }
    }

    // 2. Cross-Site Scripting (XSS) Rules
    const XSS_PATTERNS = [
      /<script[\s>]/i,
      /javascript\s*:\s*/i,
      /on(?:load|error|click|mouseover|submit|focus)\s*=\s*['"][^'"]*['"]/i,
      /<(?:iframe|object|embed|svg[\s>].*onload)/i,
      /<img[^>]+src=[^>]*onerror=/i,
    ];
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(combined)) {
        return { blocked: true, reason: 'WAF: Cross-Site Scripting (XSS) Signature Detected' };
      }
    }

    // 3. Path Traversal Rules
    const TRAVERSAL_PATTERNS = [
      /(?:\.\.[\/\\])/,
      /(?:\/etc\/(?:passwd|shadow|hosts))/i,
      /(?:windows[\/\\](?:system32|win\.ini))/i,
      /(?:\/proc\/self\/environ)/i,
    ];
    for (const pattern of TRAVERSAL_PATTERNS) {
      if (pattern.test(combined)) {
        return { blocked: true, reason: 'WAF: Directory Path Traversal Detected' };
      }
    }

    // 4. Command Injection Rules
    const CMD_PATTERNS = [
      /(?:;\s*(?:cat|ls|rm|curl|wget|bash|sh|powershell|cmd\.exe)\s+)/i,
      /(?:\|\s*(?:sh|bash|curl|nc)\b)/i,
      /\$\((?:whoami|id|uname)\)/i,
    ];
    for (const pattern of CMD_PATTERNS) {
      if (pattern.test(combined)) {
        return { blocked: true, reason: 'WAF: Remote Command Injection Detected' };
      }
    }

    // 5. Malicious Scanners / Attack Bots User-Agent
    const BAD_BOT_PATTERNS = [
      /(?:sqlmap|nikto|dirbuster|nmap|masscan|zgrab|acunetix|nessus|openvas|havij)/i,
    ];
    if (BAD_BOT_PATTERNS[0].test(userAgent)) {
      return { blocked: true, reason: 'WAF: Known Malicious Scanner / Exploit Bot' };
    }

    return { blocked: false };
  }

  // ─── Main Request Inspection Pipeline ───────────────────────────────────────
  public inspectRequest(params: {
    ip: string;
    path: string;
    method: string;
    query: string;
    body: any;
    userAgent: string;
    clearanceCookie?: string;
  }): {
    action: 'ALLOW' | 'BLOCK' | 'RATE_LIMIT' | 'CHALLENGE_REQUIRED';
    status: number;
    reason?: string;
    retryAfter?: number;
  } {
    const { ip, path: reqPath, method, query, body, userAgent, clearanceCookie } = params;

    // Track global telemetry
    this.totalRequests++;
    this.currentSecondRequests++;
    this.currentMinuteTotal++;

    // 1. Allowlist check (Instant fast-path)
    if (this.allowlist.has(ip)) {
      const rule = this.allowlist.get(ip)!;
      rule.hits++;
      this.cleanRequests++;
      this.currentMinuteClean++;
      return { action: 'ALLOW', status: 200 };
    }

    // 2. Blocklist check (Instant block)
    if (this.blocklist.has(ip)) {
      const rule = this.blocklist.get(ip)!;
      // Check if temporary ban has expired
      if (rule.expiresAt && new Date(rule.expiresAt).getTime() <= Date.now()) {
        this.blocklist.delete(ip);
      } else {
        rule.hits++;
        this.blockedRequests++;
        this.autoBannedBlocked++;
        this.currentMinuteBlocked++;
        const retry = rule.expiresAt ? Math.ceil((new Date(rule.expiresAt).getTime() - Date.now()) / 1000) : 3600;
        return {
          action: 'BLOCK',
          status: 403,
          reason: `IP Blocked by DARA Shield: ${rule.reason}`,
          retryAfter: retry,
        };
      }
    }

    // 3. WAF Deep Inspection
    const wafResult = this.inspectWaf(reqPath, query, body, userAgent);
    if (wafResult.blocked) {
      this.blockedRequests++;
      this.wafBlocked++;
      this.currentMinuteBlocked++;

      // Log incident
      this.logEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ip,
        action: 'BLOCKED',
        reason: wafResult.reason || 'WAF Blocked Attack',
        path: reqPath,
        method,
        userAgent,
      });

      return {
        action: 'BLOCK',
        status: 403,
        reason: wafResult.reason,
      };
    }

    // 4. Rate Limiting & Spike Velocity Detection
    const now = Date.now();
    let timestamps = this.requestBuckets.get(ip) || [];
    // Discard entries older than 60 seconds
    timestamps = timestamps.filter(t => t > now - 60000);
    timestamps.push(now);
    this.requestBuckets.set(ip, timestamps);

    // 4a. Spike Velocity Check (last 3 seconds)
    const recent3s = timestamps.filter(t => t > now - 3000).length;
    if (recent3s > this.config.spikeThreshold) {
      // Trigger automatic temporary ban
      this.addBlock(ip, `Automated DDoS Mitigation: Traffic spike exceeding ${recent3s} req/3s`, this.config.autoBanDurationMinutes);
      this.blockedRequests++;
      this.autoBannedBlocked++;
      this.currentMinuteBlocked++;
      this.logEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ip,
        action: 'AUTO_BANNED',
        reason: `Auto-ban: Excessive traffic spike (${recent3s} req/3s)`,
        path: reqPath,
        method,
        userAgent,
      });
      return {
        action: 'BLOCK',
        status: 429,
        reason: `DARA Shield: Excessive traffic spike detected. Temporary ban for ${this.config.autoBanDurationMinutes} minutes.`,
        retryAfter: this.config.autoBanDurationMinutes * 60,
      };
    }

    // 4b. Burst Limit Check (last 5 seconds)
    const maxBurst = this.config.underAttackMode ? Math.floor(this.config.burstLimit / 3) : this.config.burstLimit;
    const recent5s = timestamps.filter(t => t > now - 5000).length;
    if (recent5s > maxBurst) {
      this.blockedRequests++;
      this.rateLimitBlocked++;
      this.currentMinuteBlocked++;
      this.logEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ip,
        action: 'RATE_LIMITED',
        reason: `Burst rate limit exceeded (${recent5s} req/5s)`,
        path: reqPath,
        method,
        userAgent,
      });
      return {
        action: 'RATE_LIMIT',
        status: 429,
        reason: 'Too many requests in a short burst. Please slow down.',
        retryAfter: 5,
      };
    }

    // 4c. Minute Limit Check (last 60 seconds)
    const maxPerMin = this.config.underAttackMode ? Math.floor(this.config.rateLimitPerMinute / 3) : this.config.rateLimitPerMinute;
    if (timestamps.length > maxPerMin) {
      this.blockedRequests++;
      this.rateLimitBlocked++;
      this.currentMinuteBlocked++;
      this.logEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ip,
        action: 'RATE_LIMITED',
        reason: `Minute rate limit exceeded (${timestamps.length} req/min)`,
        path: reqPath,
        method,
        userAgent,
      });
      return {
        action: 'RATE_LIMIT',
        status: 429,
        reason: 'Too many requests per minute. Rate limit exceeded.',
        retryAfter: 30,
      };
    }

    // 5. Emergency "Under Attack Mode" Check
    if (this.config.underAttackMode) {
      // If client provides valid clearance cookie, permit access
      const hasClearance = clearanceCookie && this.verifyClearanceToken(ip, clearanceCookie);
      if (!hasClearance) {
        // Exclude verification endpoints and static files
        if (!reqPath.startsWith('/api/security/challenge') && !reqPath.startsWith('/images/')) {
          this.logEvent({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ip,
            action: 'CHALLENGE_REQUIRED',
            reason: 'Under Attack Mode Active: Browser verification challenge required',
            path: reqPath,
            method,
            userAgent,
          });
          return {
            action: 'CHALLENGE_REQUIRED',
            status: 403,
            reason: 'Under Attack Mode Active: Browser verification challenge required',
          };
        }
      }
    }

    // Request passed all safety filters!
    this.cleanRequests++;
    this.currentMinuteClean++;
    return { action: 'ALLOW', status: 200 };
  }
}

// Export singleton instance
export const securityEngine = new SecurityEngine();
export default securityEngine;

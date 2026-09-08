import { Router, Request, Response } from 'express';
import securityEngine from '../security/securityEngine';
import { authenticateJWT, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { getClientIp } from '../middleware/securityMiddleware';

const router = Router();

// ─── Public Challenge Endpoints (Under Attack Mode) ───────────────────────────

// 1. Get a cryptographic challenge
router.get('/challenge', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const challenge = securityEngine.generateChallenge(ip);
  return res.status(200).json({
    ip,
    challengeId: challenge.challengeId,
    nonce: challenge.nonce,
    timestamp: challenge.timestamp,
    shield: 'DARA_SHIELD_V1',
    instructions: 'Compute SHA256(challengeId + ":" + nonce) and submit to /api/security/challenge/verify',
  });
});

// 2. Verify challenge solution and receive clearance token
router.post('/challenge/verify', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const { nonce, timestamp, clientHash } = req.body;

  if (!nonce || !timestamp || !clientHash) {
    return res.status(400).json({ error: 'Missing challenge verification parameters' });
  }

  const isValid = securityEngine.verifyChallenge(ip, nonce, Number(timestamp), clientHash);
  if (!isValid) {
    return res.status(403).json({ error: 'Challenge failed or expired. Please retry.' });
  }

  // Generate clearance token valid for 24 hours
  const clearanceToken = securityEngine.createClearanceToken(ip);

  // Set HTTP-only, secure cookie (or normal cookie for development)
  res.cookie('dara_cf_clearance', clearanceToken, {
    maxAge: 24 * 3600 * 1000,
    httpOnly: false, // Accessible to front-end for header inclusion
    sameSite: 'lax',
    path: '/',
  });

  return res.status(200).json({
    success: true,
    message: 'Browser verified successfully. Access granted.',
    clearanceToken,
  });
});

// ─── Admin Protected Endpoints ────────────────────────────────────────────────

// 3. Get caller's IP (Helper for "Whitelist My IP")
router.get('/my-ip', (req: Request, res: Response) => {
  return res.status(200).json({ ip: getClientIp(req) });
});

// 4. Get real-time security statistics
router.get('/stats', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const stats = securityEngine.getStats();
  return res.status(200).json(stats);
});

// 5. Get security incident logs
router.get('/logs', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs = securityEngine.getLogs(limit);
  return res.status(200).json({ logs });
});

// 6. Get security configuration and IP lists
router.get('/config', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const config = securityEngine.getConfig();
  const allowlist = securityEngine.getAllowlist();
  const blocklist = securityEngine.getBlocklist();
  return res.status(200).json({ config, allowlist, blocklist });
});

// 7. Update security configuration (e.g. toggle Under Attack Mode)
router.put('/config', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const updated = securityEngine.updateConfig(req.body);
  return res.status(200).json({ message: 'Security configuration updated', config: updated });
});

// 8. Add IP to Blocklist
router.post('/ip/block', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { ip, reason, durationMinutes } = req.body;
  if (!ip || !ip.trim()) {
    return res.status(400).json({ error: 'Valid IP address required' });
  }
  const rule = securityEngine.addBlock(ip, reason || 'Manual Admin Ban', durationMinutes ? Number(durationMinutes) : undefined);
  return res.status(200).json({ message: `IP ${ip} has been blocked`, rule });
});

// 9. Remove IP from Blocklist (Unban)
router.post('/ip/unblock', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP is required' });
  const removed = securityEngine.removeBlock(ip);
  return res.status(200).json({ success: removed, message: `IP ${ip} unblocked` });
});

// 10. Add IP to Allowlist
router.post('/ip/allow', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { ip, reason } = req.body;
  if (!ip || !ip.trim()) {
    return res.status(400).json({ error: 'Valid IP address required' });
  }
  const rule = securityEngine.addAllow(ip, reason || 'Manual Admin Whitelist');
  return res.status(200).json({ message: `IP ${ip} has been allowlisted`, rule });
});

// 11. Remove IP from Allowlist
router.delete('/ip/allow', authenticateJWT, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP is required' });
  const removed = securityEngine.removeAllow(ip);
  return res.status(200).json({ success: removed, message: `IP ${ip} removed from allowlist` });
});

export default router;

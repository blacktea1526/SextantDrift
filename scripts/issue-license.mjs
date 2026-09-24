#!/usr/bin/env node

/**
 * SextantDrift Pro 官方授权签发与离线验签发卡工具 (Issue & Verify Ed25519 Licenses)
 *
 * 用法 (Usage):
 *   1. 签发终身版 Pro 激活码:
 *      node scripts/issue-license.mjs --email founder@company.com --type lifetime
 *
 *   2. 签发年度/月度订阅 Key:
 *      node scripts/issue-license.mjs --email client@corp.com --type monthly --days 30
 *
 *   3. 离线校验 License Token:
 *      node scripts/issue-license.mjs --verify <token>
 *
 *   4. 生成全新 Ed25519 密钥对:
 *      node scripts/issue-license.mjs --generate-keys
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// 官方默认预置 Ed25519 密钥对 (可通过环境变量 SEXTANT_PRIVATE_KEY 或 SEXTANT_PUBLIC_KEY 覆盖)
export const DEFAULT_OFFICIAL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAohCb/L20nK+33V0lRSbtSkPs+Pvcp3U/YqlEG9N8LZc=
-----END PUBLIC KEY-----`;

export const DEFAULT_OFFICIAL_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIDCYE2+/wRTiMFSoeLqSv1RzXfq/QF8K44691aqC/ZWD
-----END PRIVATE KEY-----`;

/**
 * 签发 Ed25519 强防伪 JWT 格式 License Token
 */
export function issueLicense(options = {}, privateKeyPem = DEFAULT_OFFICIAL_PRIVATE_KEY) {
  const {
    userEmail = 'customer@sextantdrift.com',
    type = 'lifetime',
    tier = 'pro',
    days = 3650, // 默认 10 年（终身）
    licenseId = `SEXTANT-PRO-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
  } = options;

  const now = Date.now();
  const expiresAt = type === 'lifetime'
    ? now + 100 * 365 * 24 * 3600 * 1000 // 100 年
    : now + days * 24 * 3600 * 1000;

  const header = {
    alg: 'EdDSA',
    typ: 'JWT',
  };

  const payload = {
    licenseId,
    type,
    tier,
    issuedAt: now,
    expiresAt,
    userEmail,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const dataToSign = Buffer.from(`${headerB64}.${payloadB64}`);

  const signature = crypto.sign(null, dataToSign, privateKeyPem);
  const sigB64 = signature.toString('base64url');

  const token = `${headerB64}.${payloadB64}.${sigB64}`;
  return { token, payload };
}

/**
 * 离线验证 License Token
 */
export function verifyLicense(token, publicKeyPem = DEFAULT_OFFICIAL_PUBLIC_KEY) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Empty or invalid token format' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Malformed token structure (expected 3 parts)' };
  }

  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return {
        valid: false,
        reason: `License expired at ${new Date(payload.expiresAt).toISOString()}`,
        payload,
      };
    }

    const dataToVerify = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');

    const isValid = crypto.verify(null, dataToVerify, publicKeyPem, signature);
    if (!isValid) {
      return { valid: false, reason: 'Digital signature mismatch (tampered or forged)' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` };
  }
}

/**
 * 生成全新 Ed25519 密钥对
 */
export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// CLI 执行入口
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);

  if (args.includes('--generate-keys')) {
    const keys = generateKeyPair();
    console.log('=== NEW ED25519 PUBLIC KEY (Embed into license-manager.ts) ===');
    console.log(keys.publicKeyPem);
    console.log('=== NEW ED25519 PRIVATE KEY (Keep secret for license issuing) ===');
    console.log(keys.privateKeyPem);
    process.exit(0);
  }

  const verifyIdx = args.indexOf('--verify');
  if (verifyIdx !== -1) {
    const token = args[verifyIdx + 1];
    if (!token) {
      console.error('Error: Please provide token: node scripts/issue-license.mjs --verify <token>');
      process.exit(1);
    }
    const result = verifyLicense(token);
    console.log('License Verification Result:', result);
    process.exit(result.valid ? 0 : 1);
  }

  // 解析发卡参数
  const getArg = (flag, def) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
  };

  const email = getArg('--email', 'customer@example.com');
  const type = getArg('--type', 'lifetime');
  const days = parseInt(getArg('--days', type === 'monthly' ? '30' : '3650'), 10);
  const privKey = process.env.SEXTANT_PRIVATE_KEY || DEFAULT_OFFICIAL_PRIVATE_KEY;

  const { token, payload } = issueLicense({ userEmail: email, type, days }, privKey);

  console.log('======================================================');
  console.log('           SextantDrift Pro 商业授权激活码            ');
  console.log('======================================================');
  console.log(`License ID : ${payload.licenseId}`);
  console.log(`User Email : ${payload.userEmail}`);
  console.log(`Tier       : ${payload.tier.toUpperCase()}`);
  console.log(`Type       : ${payload.type}`);
  console.log(`Issued At  : ${new Date(payload.issuedAt).toISOString()}`);
  console.log(`Expires At : ${new Date(payload.expiresAt).toISOString()}`);
  console.log('------------------------------------------------------');
  console.log('License Token (请在 VS Code 插件按 Cmd+Shift+P -> "Sextant: Enter Pro License Key" 粘贴):');
  console.log('');
  console.log(token);
  console.log('======================================================');
}

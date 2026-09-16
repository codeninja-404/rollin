/**
 * OTP utilities — server-side only.
 * Uses TOTP algorithm with a configurable period (default 5s).
 */

import { TOTP, Secret } from 'otpauth';

const DEFAULT_PERIOD = 5; // seconds
const DIGITS = 6;

/**
 * Generate a new random OTP secret (base32 encoded).
 */
export function generateSecret(): string {
  return new Secret({ size: 20 }).base32;
}

/**
 * Get the current OTP for a given secret and period.
 */
export function getCurrentOTP(secret: string, period: number = DEFAULT_PERIOD): string {
  const p = Math.max(2, period || DEFAULT_PERIOD);
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    digits: DIGITS,
    period: p,
    algorithm: 'SHA1',
  });
  return totp.generate();
}

/**
 * Get the next upcoming OTP for the subsequent window so clients can prefetch
 * and transition smoothly with zero network delay.
 */
export function getNextOTP(secret: string, period: number = DEFAULT_PERIOD): string {
  const p = Math.max(2, period || DEFAULT_PERIOD);
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    digits: DIGITS,
    period: p,
    algorithm: 'SHA1',
  });
  const now = Math.floor(Date.now() / 1000);
  const nextTimestamp = (Math.floor(now / p) + 1) * p * 1000;
  return totp.generate({ timestamp: nextTimestamp });
}

/**
 * How many seconds remain in the current OTP window.
 */
export function getSecondsRemaining(period: number = DEFAULT_PERIOD): number {
  const p = Math.max(2, period || DEFAULT_PERIOD);
  const now = Math.floor(Date.now() / 1000);
  return p - (now % p);
}

/**
 * Validate a submitted OTP for a given period. Accepts current window and 1 previous window
 * to account for network latency.
 */
export function validateOTP(secret: string, otp: string, period: number = DEFAULT_PERIOD): boolean {
  const p = Math.max(2, period || DEFAULT_PERIOD);
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    digits: DIGITS,
    period: p,
    algorithm: 'SHA1',
  });
  // window: 1 = accept current + 1 previous period
  const delta = totp.validate({ token: otp, window: 1 });
  return delta !== null;
}

export const OTP_PERIOD = DEFAULT_PERIOD;

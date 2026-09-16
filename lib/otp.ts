/**
 * OTP utilities — server-side only.
 * Uses TOTP algorithm with a 5-second period.
 */

import { TOTP, Secret } from 'otpauth';

const PERIOD = 5; // seconds
const DIGITS = 6;

/**
 * Generate a new random OTP secret (base32 encoded).
 */
export function generateSecret(): string {
  return new Secret({ size: 20 }).base32;
}

/**
 * Get the current OTP for a given secret.
 */
export function getCurrentOTP(secret: string): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    digits: DIGITS,
    period: PERIOD,
    algorithm: 'SHA1',
  });
  return totp.generate();
}

/**
 * How many seconds remain in the current OTP window.
 */
export function getSecondsRemaining(): number {
  const now = Math.floor(Date.now() / 1000);
  return PERIOD - (now % PERIOD);
}

/**
 * Validate a submitted OTP. Accepts current window and 1 previous window
 * to account for network latency.
 */
export function validateOTP(secret: string, otp: string): boolean {
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    digits: DIGITS,
    period: PERIOD,
    algorithm: 'SHA1',
  });
  // window: 1 = accept current + 1 previous period
  const delta = totp.validate({ token: otp, window: 1 });
  return delta !== null;
}

export const OTP_PERIOD = PERIOD;

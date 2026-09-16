/**
 * IP utilities for campus network validation — server-side only.
 */

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { CampusNetwork } from '@/lib/types';

/**
 * Extract the real client IP from a Next.js request.
 * Handles Vercel, Cloudflare, and standard reverse-proxy headers.
 */
export function getClientIP(request: NextRequest): string {
  // Vercel sets this header with the real client IP
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  // Standard forwarded-for — take the FIRST IP (the original client)
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0].trim();
    if (first) return first;
  }

  return '127.0.0.1';
}

/**
 * Check if an IP address falls within a CIDR range.
 * Supports IPv4 only (campus networks are typically IPv4).
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    if (!range || bits === undefined) return false;

    const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;

    const ipNum = ipToNum(ip);
    const rangeNum = ipToNum(range);

    if (ipNum === null || rangeNum === null) return false;

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

function ipToNum(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Validate that an IP is within any active campus network.
 * Returns { valid: true } or { valid: false, message: string }.
 */
export async function validateCampusIP(
  ip: string,
): Promise<{ valid: boolean; message?: string }> {
  // Always allow loopback (dev/testing)
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { valid: true };
  }

  const supabase = createAdminClient();
  const { data: networks, error } = await supabase
    .from('campus_networks')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('Failed to fetch campus networks:', error);
    return { valid: false, message: 'Unable to verify campus network.' };
  }

  if (!networks || networks.length === 0) {
    // No networks configured — allow all (open mode)
    return { valid: true };
  }

  const isValid = (networks as CampusNetwork[]).some((net) => isIPInCIDR(ip, net.cidr));

  if (!isValid) {
    return {
      valid: false,
      message: 'Attendance can only be submitted from the campus network.',
    };
  }

  return { valid: true };
}

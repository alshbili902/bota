import dns from 'node:dns/promises';
import path from 'node:path';

// Private and reserved IP patterns (IPv4 and IPv6)
const PRIVATE_IPV4_REGEX =
  /^(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)$/;

const RESERVED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'local',
  'broadcasthost',
  'metadata.google.internal',
]);

/**
 * Checks if a string is a valid HTTP/HTTPS URL
 */
export function isValidUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates that an IP address is not private or local
 */
export function isPrivateIp(ip: string): boolean {
  if (PRIVATE_IPV4_REGEX.test(ip)) {
    return true;
  }
  // IPv6 checks
  const lower = ip.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') || // Link-local
    lower.startsWith('fc00:') || // Unique local
    lower.startsWith('fd00:') || // Unique local
    lower.startsWith('::ffff:127.') || // IPv4-mapped loopback
    lower.startsWith('::ffff:10.') ||
    lower.startsWith('::ffff:192.168.') ||
    lower.startsWith('::ffff:172.') ||
    lower.startsWith('::ffff:169.254.')
  ) {
    return true;
  }
  return false;
}

/**
 * Performs deep SSRF checks against a URL:
 * 1. Checks protocol (only http/https)
 * 2. Checks hostname against reserved local names
 * 3. Resolves DNS to ensure it does not point to internal/private IPs
 */
export async function isSafeUrl(rawUrl: string): Promise<boolean> {
  if (!isValidUrl(rawUrl)) {
    return false;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    const hostname = parsed.hostname.toLowerCase();

    // Check against blacklisted hostnames
    if (RESERVED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      return false;
    }

    // If hostname is directly an IP
    if (isPrivateIp(hostname)) {
      return false;
    }

    // Resolve DNS to verify it doesn't resolve to private IP
    try {
      const records = await dns.lookup(hostname, { all: true });
      for (const record of records) {
        if (isPrivateIp(record.address)) {
          return false;
        }
      }
    } catch {
      // If DNS lookup fails, allow yt-dlp to attempt resolution unless it's a known bad pattern
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a filename to prevent path traversal, control characters, and illegal characters
 */
export function sanitizeFilename(name: string, fallbackExt = '.bin'): string {
  if (!name || typeof name !== 'string') {
    return `file_${Date.now()}${fallbackExt}`;
  }

  // Extract base filename (strip any path components)
  const base = path.basename(name.trim());

  // Split extension
  const ext = path.extname(base);
  const nameWithoutExt = path.basename(base, ext);

  // Remove illegal characters: <>:"/\|?*\0 and non-printable control characters
  let cleanName = nameWithoutExt
    .replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '_')
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/^\.+/, '') // remove leading dots
    .replace(/\s+/g, ' ') // collapse spaces
    .trim();

  // If filename became empty after sanitization
  if (!cleanName || cleanName === '.' || cleanName === '..') {
    cleanName = `download_${Date.now()}`;
  }

  // Truncate length if too long (max 100 chars base name)
  if (cleanName.length > 100) {
    cleanName = cleanName.substring(0, 100).trim();
  }

  // Clean extension
  let cleanExt = ext.replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '').trim();
  if (!cleanExt || cleanExt === '.') {
    cleanExt = fallbackExt.startsWith('.') ? fallbackExt : `.${fallbackExt}`;
  }

  return `${cleanName}${cleanExt}`;
}

/**
 * Sanitizes a URL for safe logging (removes sensitive query parameters like tokens or keys)
 */
export function sanitizeLogUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[INVALID_URL]';
  }
}

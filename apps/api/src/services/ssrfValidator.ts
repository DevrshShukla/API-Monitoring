import dns from 'dns/promises';
import net from 'net';
import { env } from '../config/env.js';

export interface SsrValidationResult {
  valid: boolean;
  reason?: string;
  url?: URL;
  resolvedIp?: string;
}

// Allowed outbound ports parsed from environment
const allowedPorts = new Set(
  env.ALLOWED_MONITOR_PORTS.split(',')
    .map((p) => parseInt(p.trim(), 10))
    .filter((p) => !isNaN(p) && p > 0 && p <= 65535)
);

function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function inIpv4Range(ipInt: number, baseIp: string, cidr: number): boolean {
  const baseInt = ipv4ToInt(baseIp);
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isPrivateIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);

  // 0.0.0.0/8
  if (inIpv4Range(ipInt, '0.0.0.0', 8)) return true;
  // 10.0.0.0/8 (Private)
  if (inIpv4Range(ipInt, '10.0.0.0', 8)) return true;
  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (inIpv4Range(ipInt, '100.64.0.0', 10)) return true;
  // 127.0.0.0/8 (Loopback)
  if (inIpv4Range(ipInt, '127.0.0.0', 8)) return true;
  // 169.254.0.0/16 (Link-Local, AWS/GCP/Azure Metadata: 169.254.169.254)
  if (inIpv4Range(ipInt, '169.254.0.0', 16)) return true;
  // 172.16.0.0/12 (Private)
  if (inIpv4Range(ipInt, '172.16.0.0', 12)) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (inIpv4Range(ipInt, '192.0.0.0', 24)) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (inIpv4Range(ipInt, '192.0.2.0', 24)) return true;
  // 192.88.99.0/24 (6to4 Relay Anycast)
  if (inIpv4Range(ipInt, '192.88.99.0', 24)) return true;
  // 192.168.0.0/16 (Private)
  if (inIpv4Range(ipInt, '192.168.0.0', 16)) return true;
  // 198.18.0.0/15 (Network Interconnect Benchmark)
  if (inIpv4Range(ipInt, '198.18.0.0', 15)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (inIpv4Range(ipInt, '198.51.100.0', 24)) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (inIpv4Range(ipInt, '203.0.113.0', 24)) return true;
  // 224.0.0.0/4 (Multicast)
  if (inIpv4Range(ipInt, '224.0.0.0', 4)) return true;
  // 240.0.0.0/4 (Reserved for Future Use)
  if (inIpv4Range(ipInt, '240.0.0.0', 4)) return true;
  // 255.255.255.255/32 (Broadcast)
  if (ip === '255.255.255.255') return true;

  // Cloud metadata extra checks
  if (ip === '100.100.100.200') return true; // Alibaba Cloud metadata

  return false;
}

export function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // IPv4-mapped IPv6: ::ffff:192.0.2.1
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.substring(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateIpv4(v4Part);
    }
  }

  // ::/128 Unspecified
  if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
  // ::1/128 Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  // fc00::/7 Unique Local Address (private)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;
  // fe80::/10 Link-Local Unicast
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;
  // ff00::/8 Multicast
  if (/^ff[0-9a-f]{2}:/i.test(normalized)) return true;
  // 2001:db8::/32 Documentation
  if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0db8:')) return true;

  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export async function validateAndResolveUrl(inputUrl: string): Promise<SsrValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  // Scheme must be strictly http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Invalid protocol. Only http: and https: are permitted' };
  }

  // Credentials are not permitted
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URL credentials are not permitted' };
  }

  // Port validation
  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
  if (!allowedPorts.has(port)) {
    return { valid: false, reason: `Port ${port} is not in the allowed outbound ports list` };
  }

  // Host validation
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { valid: false, reason: 'Missing hostname' };
  }

  // Deny special hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    return { valid: false, reason: 'Restricted internal hostname' };
  }

  // Check if hostname is already a raw IP
  const isDirectIp = net.isIP(hostname);
  if (isDirectIp) {
    if (isPrivateIp(hostname)) {
      return { valid: false, reason: 'Target resolved to private or restricted network address' };
    }
    return { valid: true, url: parsed, resolvedIp: hostname };
  }

  // Resolve DNS A and AAAA records
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: 'DNS resolution returned no addresses' };
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        return {
          valid: false,
          reason: 'Target resolved to private or restricted network address',
        };
      }
    }

    // Return first validated IP for connection pinning
    return {
      valid: true,
      url: parsed,
      resolvedIp: addresses[0].address,
    };
  } catch (error: any) {
    return { valid: false, reason: `DNS resolution failed: ${error.message || 'Unknown error'}` };
  }
}

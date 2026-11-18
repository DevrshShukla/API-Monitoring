import { describe, it, expect } from 'vitest';
import {
  isPrivateIpv4,
  isPrivateIpv6,
  isPrivateIp,
  validateAndResolveUrl,
} from '../src/services/ssrfValidator.js';

describe('SSRF Validator (TC-SEC-001, SEC-SSRF-001..009)', () => {
  it('correctly identifies private and loopback IPv4 addresses', () => {
    expect(isPrivateIpv4('127.0.0.1')).toBe(true);
    expect(isPrivateIpv4('127.0.0.254')).toBe(true);
    expect(isPrivateIpv4('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4('10.255.255.255')).toBe(true);
    expect(isPrivateIpv4('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4('172.31.255.255')).toBe(true);
    expect(isPrivateIpv4('192.168.0.1')).toBe(true);
    expect(isPrivateIpv4('192.168.254.254')).toBe(true);
    expect(isPrivateIpv4('169.254.169.254')).toBe(true); // AWS/GCP metadata
    expect(isPrivateIpv4('100.100.100.200')).toBe(true); // Alibaba metadata
    expect(isPrivateIpv4('0.0.0.0')).toBe(true);

    // Public IPs should return false
    expect(isPrivateIpv4('8.8.8.8')).toBe(false);
    expect(isPrivateIpv4('1.1.1.1')).toBe(false);
    expect(isPrivateIpv4('93.184.216.34')).toBe(false);
  });

  it('correctly identifies private and loopback IPv6 addresses', () => {
    expect(isPrivateIpv6('::1')).toBe(true);
    expect(isPrivateIpv6('::')).toBe(true);
    expect(isPrivateIpv6('fe80::1')).toBe(true);
    expect(isPrivateIpv6('fc00::1')).toBe(true);
    expect(isPrivateIpv6('fd12:3456:789a::1')).toBe(true);
    expect(isPrivateIpv6('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIpv6('::ffff:10.0.0.1')).toBe(true);

    // Public IPv6
    expect(isPrivateIpv6('2606:4700:4700::1111')).toBe(false);
  });

  it('rejects URLs with disallowed protocols', async () => {
    const fileRes = await validateAndResolveUrl('file:///etc/passwd');
    expect(fileRes.valid).toBe(false);
    expect(fileRes.reason).toMatch(/protocol/i);

    const ftpRes = await validateAndResolveUrl('ftp://example.com/test');
    expect(ftpRes.valid).toBe(false);

    const gopherRes = await validateAndResolveUrl('gopher://example.com/1');
    expect(gopherRes.valid).toBe(false);
  });

  it('rejects URLs containing credentials', async () => {
    const res = await validateAndResolveUrl('https://admin:password@example.com/api');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/credentials/i);
  });

  it('rejects URLs with disallowed ports (e.g., SSH port 22)', async () => {
    const res = await validateAndResolveUrl('http://1.1.1.1:22/health');
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/port/i);
  });

  it('rejects direct private IPs in URL', async () => {
    const loopback = await validateAndResolveUrl('http://127.0.0.1/status');
    expect(loopback.valid).toBe(false);

    const metadata = await validateAndResolveUrl('http://169.254.169.254/latest/meta-data/');
    expect(metadata.valid).toBe(false);

    const private10 = await validateAndResolveUrl('http://10.1.2.3:80/ping');
    expect(private10.valid).toBe(false);
  });

  it('rejects internal restricted hostnames', async () => {
    const localhost = await validateAndResolveUrl('http://localhost:80/api');
    expect(localhost.valid).toBe(false);

    const internalHost = await validateAndResolveUrl('http://service.internal:80/api');
    expect(internalHost.valid).toBe(false);

    const gcpMeta = await validateAndResolveUrl('http://metadata.google.internal/');
    expect(gcpMeta.valid).toBe(false);
  });

  it('accepts valid public IP directly', async () => {
    const res = await validateAndResolveUrl('https://1.1.1.1/dns-query');
    expect(res.valid).toBe(true);
    expect(res.resolvedIp).toBe('1.1.1.1');
  });
});

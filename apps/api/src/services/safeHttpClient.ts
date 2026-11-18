import http from 'http';
import https from 'https';
import net from 'net';
import { validateAndResolveUrl } from './ssrfValidator.js';
import { CheckOutcome, CHECK_OUTCOME } from '@api-monitoring/shared';
import { env } from '../config/env.js';

export interface HttpRequestOptions {
  url: string;
  method: string;
  timeoutMs: number;
  expectedStatusCodes: number[];
  headers?: Record<string, string>;
  body?: string;
  bodyContentType?: string;
}

export interface CheckExecutionResult {
  outcome: CheckOutcome;
  statusCode: number | null;
  latencyMs: number;
  responseBytes: number;
  errorCategory: string | null;
  errorMessageSafe: string | null;
  completedAt: Date;
  startedAt: Date;
}

export async function executeSafeRequest(options: HttpRequestOptions): Promise<CheckExecutionResult> {
  const startedAt = new Date();
  const startTime = process.hrtime.bigint();

  // 1. SSRF Validation & DNS Pinning
  const validation = await validateAndResolveUrl(options.url);
  if (!validation.valid || !validation.url || !validation.resolvedIp) {
    const elapsedMs = Number((process.hrtime.bigint() - startTime) / 1000000n);
    return {
      outcome: CHECK_OUTCOME.BLOCKED,
      statusCode: null,
      latencyMs: elapsedMs,
      responseBytes: 0,
      errorCategory: 'SSRF_BLOCKED',
      errorMessageSafe: validation.reason || 'Blocked by security policy',
      startedAt,
      completedAt: new Date(),
    };
  }

  const parsedUrl = validation.url;
  const pinnedIp = validation.resolvedIp;
  const isHttps = parsedUrl.protocol === 'https:';

  return new Promise<CheckExecutionResult>((resolve) => {
    let completed = false;
    let responseBytes = 0;
    const maxBytes = env.MAX_RESPONSE_BYTES;
    const isIpV4 = net.isIP(pinnedIp) === 4;

    type CustomLookup = (
      hostname: string,
      opts: any,
      callback: (err: Error | null, address: string, family: number) => void
    ) => void;

    const customLookup: CustomLookup = (_hostname, _opts, callback) => {
      // Pin to validated IP, preventing DNS rebinding
      callback(null, pinnedIp, isIpV4 ? 4 : 6);
    };

    const headers: Record<string, string> = {
      'User-Agent': 'ApiMonitoringBot/1.0 (+https://apimonitor.local)',
      Accept: '*/*',
      ...options.headers,
    };

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = options.bodyContentType || 'application/json';
    }

    const requestOptions: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method.toUpperCase(),
      headers,
      timeout: options.timeoutMs,
      lookup: customLookup,
      servername: isHttps ? parsedUrl.hostname : undefined, // SNI for TLS
      rejectUnauthorized: true, // Validate TLS certificate
    };

    const client = isHttps ? https : http;

    const req = client.request(requestOptions, (res) => {
      const statusCode = res.statusCode || null;

      // Handle redirect restriction (default: disabled)
      if (statusCode && statusCode >= 300 && statusCode < 400 && res.headers.location) {
        req.destroy();
        if (!completed) {
          completed = true;
          const elapsedMs = Number((process.hrtime.bigint() - startTime) / 1000000n);
          return resolve({
            outcome: CHECK_OUTCOME.BLOCKED,
            statusCode,
            latencyMs: elapsedMs,
            responseBytes,
            errorCategory: 'REDIRECT_DENIED',
            errorMessageSafe: 'HTTP redirects are disabled for security policy',
            startedAt,
            completedAt: new Date(),
          });
        }
      }

      res.on('data', (chunk: Buffer) => {
        responseBytes += chunk.length;
        if (responseBytes > maxBytes) {
          req.destroy();
          if (!completed) {
            completed = true;
            const elapsedMs = Number((process.hrtime.bigint() - startTime) / 1000000n);
            return resolve({
              outcome: CHECK_OUTCOME.HTTP_ERROR,
              statusCode,
              latencyMs: elapsedMs,
              responseBytes,
              errorCategory: 'RESPONSE_TOO_LARGE',
              errorMessageSafe: `Response exceeded maximum size of ${maxBytes} bytes`,
              startedAt,
              completedAt: new Date(),
            });
          }
        }
      });

      res.on('end', () => {
        if (!completed) {
          completed = true;
          const elapsedMs = Number((process.hrtime.bigint() - startTime) / 1000000n);
          const isExpected = statusCode !== null && options.expectedStatusCodes.includes(statusCode);

          resolve({
            outcome: isExpected ? CHECK_OUTCOME.SUCCESS : CHECK_OUTCOME.HTTP_ERROR,
            statusCode,
            latencyMs: elapsedMs,
            responseBytes,
            errorCategory: isExpected ? null : 'UNEXPECTED_STATUS_CODE',
            errorMessageSafe: isExpected ? null : `Received HTTP ${statusCode}, expected [${options.expectedStatusCodes.join(', ')}]`,
            startedAt,
            completedAt: new Date(),
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (!completed) {
        completed = true;
        const elapsedMs = Number((process.hrtime.bigint() - startTime) / 1000000n);
        resolve({
          outcome: CHECK_OUTCOME.TIMEOUT,
          statusCode: null,
          latencyMs: elapsedMs,
          responseBytes: 0,
          errorCategory: 'TIMEOUT',
          errorMessageSafe: `Request timed out after ${options.timeoutMs}ms`,
          startedAt,
          completedAt: new Date(),
        });
      }
    });

    req.on('error', (err: any) => {
      if (completed) return;
      completed = true;
      const elapsedMs = Number((process.hrtime.bigint() - startTime) / 1000000n);

      let outcome: CheckOutcome = CHECK_OUTCOME.NETWORK_ERROR;
      let errorCategory = 'NETWORK_ERROR';
      let safeMessage = 'Network connection failed';

      if (err.code === 'ECONNREFUSED') {
        safeMessage = 'Connection refused by target host';
      } else if (err.code === 'ENOTFOUND') {
        safeMessage = 'Target host could not be resolved';
      } else if (
        err.code === 'CERT_HAS_EXPIRED' ||
        err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        err.code?.startsWith('ERR_TLS')
      ) {
        outcome = CHECK_OUTCOME.TLS_ERROR;
        errorCategory = 'TLS_ERROR';
        safeMessage = 'TLS certificate validation failed';
      }

      resolve({
        outcome,
        statusCode: null,
        latencyMs: elapsedMs,
        responseBytes: 0,
        errorCategory,
        errorMessageSafe: safeMessage,
        startedAt,
        completedAt: new Date(),
      });
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

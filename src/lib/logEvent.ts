/**
 * logEvent.ts — Frontend event logger
 * Sends structured log events to the worker for Cloudflare observability.
 * Fire-and-forget — never throws, never blocks.
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined;
const DEFAULT_DEALER = import.meta.env.VITE_DEFAULT_DEALER as string | undefined;

export type LogLevel = 'info' | 'warn' | 'error';

export function logEvent(
  level: LogLevel,
  type: string,
  data: Record<string, unknown> = {},
  dealerKey?: string,
): void {
  if (!WORKER_URL) return;
  fetch(`${WORKER_URL}/api/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dealer-Key': dealerKey || DEFAULT_DEALER || 'unknown',
    },
    body: JSON.stringify({
      level,
      type,
      source: 'frontend',
      ...data,
      ts: new Date().toISOString(),
    }),
  }).catch(() => {}); // fire and forget
}
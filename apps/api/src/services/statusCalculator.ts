import { MonitorStatus, MONITOR_STATUS, CheckOutcome, CHECK_OUTCOME, CONFIG_DEFAULTS } from '@api-monitoring/shared';

export interface StatusCalculationInput {
  active: boolean;
  latestOutcome: CheckOutcome;
  latestLatencyMs: number;
  consecutiveFailures: number;
  recentSuccessRatio: number | null; // e.g. 0.95
  latencyThresholdMs: number;
  failuresToDownThreshold?: number;
  previousStatus?: MonitorStatus;
}

export function computeMonitorStatus(input: StatusCalculationInput): MonitorStatus {
  // 1. Paused overrides everything
  if (!input.active) {
    return MONITOR_STATUS.PAUSED;
  }

  const failuresToDown = input.failuresToDownThreshold ?? CONFIG_DEFAULTS.FAILURES_TO_DOWN;
  const isFailure = input.latestOutcome !== CHECK_OUTCOME.SUCCESS;

  // 2. Down state: latest outcome is failure AND consecutive failure count >= threshold
  if (isFailure && input.consecutiveFailures >= failuresToDown) {
    return MONITOR_STATUS.DOWN;
  }

  // If latest is a failure but hasn't reached FAILURES_TO_DOWN threshold
  if (isFailure) {
    // If it was already DOWN, it remains DOWN
    if (input.previousStatus === MONITOR_STATUS.DOWN) {
      return MONITOR_STATUS.DOWN;
    }
    // Otherwise, early failure warning is treated as DEGRADED
    return MONITOR_STATUS.DEGRADED;
  }

  // 3. Degraded state: latest check is success, BUT:
  // - Latency exceeds configured threshold, OR
  // - Rolling success ratio is below threshold (95%)
  const latencyExceeded = input.latestLatencyMs > input.latencyThresholdMs;
  const ratioDegraded =
    input.recentSuccessRatio !== null &&
    input.recentSuccessRatio < CONFIG_DEFAULTS.DEGRADED_SUCCESS_RATIO_THRESHOLD;

  if (latencyExceeded || ratioDegraded) {
    return MONITOR_STATUS.DEGRADED;
  }

  // 4. Operational state: latest check is success and latency and ratio are healthy
  return MONITOR_STATUS.OPERATIONAL;
}

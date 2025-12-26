// Lightweight helper to fan out telemetry without hard coupling.
export function safeEmit(onEvent, payload) {
  if (typeof onEvent !== 'function') return;
  try {
    onEvent(payload);
  } catch (err) {
    // Swallow to avoid cascading failures; caller can enable debug logging if desired.
  }
}

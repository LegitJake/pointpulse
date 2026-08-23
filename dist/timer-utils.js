export const MEAL_DURATION_SECONDS = 90 * 60;

export function getRemainingSeconds(endTime, now = Date.now()) {
  if (!Number.isFinite(endTime) || endTime <= now) return 0;
  return Math.ceil((endTime - now) / 1000);
}

export function getExpirationTimestamp(now, durationSeconds = MEAL_DURATION_SECONDS) {
  return now + durationSeconds * 1000;
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export function getProgress(remainingSeconds, totalSeconds = MEAL_DURATION_SECONDS) {
  const elapsed = totalSeconds - Math.max(0, Math.min(totalSeconds, remainingSeconds));
  return (elapsed / totalSeconds) * 100;
}

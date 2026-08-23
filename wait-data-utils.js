export function parseQueueWait(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function getQueueStatus({ sourceStatus, isOpen }) {
  const rawStatus = typeof sourceStatus === 'string' ? sourceStatus.trim() : '';
  const normalized = rawStatus.toLowerCase();
  if (normalized.includes('down')) return 'Down';
  if (normalized.includes('closed')) return 'Closed';
  if (normalized.includes('open') || normalized.includes('operating') || normalized.includes('running')) return 'Open';
  if (normalized.includes('unknown')) return 'Data unavailable';
  if (rawStatus) return rawStatus.toUpperCase();
  if (isOpen === true) return 'Open';
  if (isOpen === false) return 'Closed';
  return 'Data unavailable';
}

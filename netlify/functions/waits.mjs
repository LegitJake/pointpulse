const QUEUE_TIMES_URL = 'https://queue-times.com/parks/50/queue_times.json';

function normaliseStatus(ride) {
  const sourceStatus = String(ride.status || ride.state || ride.operating_status || '').trim();
  const normalized = sourceStatus.toLowerCase();
  if (normalized.includes('down')) return 'Down';
  if (normalized.includes('closed')) return 'Closed';
  if (normalized.includes('open') || normalized.includes('operating') || normalized.includes('running')) return 'Open';
  if (normalized.includes('unknown')) return 'Data unavailable';
  if (ride.is_open === true) return 'Open';
  if (ride.is_open === false) return 'Closed';
  return 'Data unavailable';
}

function withStatus(ride) { return { ...ride, status: normaliseStatus(ride) }; }

function normalisePayload(payload) {
  return {
    ...payload,
    lands: (payload.lands || []).map((land) => ({ ...land, rides: (land.rides || []).map(withStatus) })),
    rides: (payload.rides || []).map(withStatus)
  };
}

export default async () => {
  try {
    const response = await fetch(QUEUE_TIMES_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error(`Queue-Times returned ${response.status}`);
    const payload = normalisePayload(await response.json());
    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Live wait times are temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
};

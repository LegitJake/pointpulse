const SANDUSKY_LATITUDE = 41.4489;
const SANDUSKY_LONGITUDE = -82.708;
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${SANDUSKY_LATITUDE}&longitude=${SANDUSKY_LONGITUDE}&current=temperature_2m,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=1`;

export default async () => {
  try {
    const response = await fetch(WEATHER_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const payload = await response.json();
    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Sandusky weather is temporarily unavailable.' }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
};

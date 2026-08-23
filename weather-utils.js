export function weatherDetails(code, isDay = true) {
  const details = {
    0: ['Sunny', isDay ? '☀' : '☾'], 1: ['Mostly Sunny', isDay ? '☀' : '☾'], 2: ['Partly Cloudy', '⛅'], 3: ['Cloudy', '☁'],
    45: ['Foggy', '〰'], 48: ['Icy Fog', '〰'], 51: ['Light Drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy Drizzle', '🌧'],
    56: ['Freezing Drizzle', '🌧'], 57: ['Heavy Freezing Drizzle', '🌧'], 61: ['Light Rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy Rain', '🌧'],
    66: ['Freezing Rain', '🌧'], 67: ['Heavy Freezing Rain', '🌧'], 71: ['Light Snow', '❄'], 73: ['Snow', '❄'], 75: ['Heavy Snow', '❄'],
    77: ['Snow Grains', '❄'], 80: ['Rain Showers', '🌦'], 81: ['Rain Showers', '🌧'], 82: ['Heavy Showers', '🌧'],
    85: ['Snow Showers', '❄'], 86: ['Heavy Snow Showers', '❄'], 95: ['Thunderstorm', '⛈'], 96: ['Thunderstorm with Hail', '⛈'], 99: ['Severe Thunderstorm', '⛈']
  };
  return details[code] || ['Conditions unavailable', '◌'];
}

export function isSevereWeather(code) { return [95, 96, 99].includes(code); }

import assert from 'node:assert/strict';
import test from 'node:test';
import { isSevereWeather, weatherDetails } from '../weather-utils.js';

test('maps WMO codes to readable conditions and icons', () => {
  assert.deepEqual(weatherDetails(0), ['Sunny', '☀']);
  assert.deepEqual(weatherDetails(63), ['Rain', '🌧']);
  assert.deepEqual(weatherDetails(95), ['Thunderstorm', '⛈']);
});

test('identifies thunderstorm weather codes as severe', () => {
  assert.equal(isSevereWeather(95), true);
  assert.equal(isSevereWeather(99), true);
  assert.equal(isSevereWeather(63), false);
});

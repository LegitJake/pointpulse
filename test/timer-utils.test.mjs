import assert from 'node:assert/strict';
import test from 'node:test';
import { MEAL_DURATION_SECONDS, formatTime, getExpirationTimestamp, getProgress, getRemainingSeconds } from '../timer-utils.js';

test('a new 90-minute timer shows the complete duration', () => {
  const now = 1_000_000;
  assert.equal(getRemainingSeconds(now + MEAL_DURATION_SECONDS * 1000, now), 5400);
  assert.equal(formatTime(5400), '90:00');
});

test('remaining time decreases correctly after a second and persists from an end timestamp', () => {
  const now = 1_000_000;
  const endTime = getExpirationTimestamp(now, MEAL_DURATION_SECONDS);
  assert.equal(endTime, now + 5_400_000);
  assert.equal(formatTime(getRemainingSeconds(endTime, now + 1000)), '89:59');
  assert.equal(formatTime(getRemainingSeconds(endTime, now + 2_701_000)), '44:59');
});

test('an expired timer stops at zero and never returns a negative time', () => {
  assert.equal(getRemainingSeconds(1_000, 1_000), 0);
  assert.equal(getRemainingSeconds(1_000, 2_000), 0);
  assert.equal(formatTime(0), '00:00');
  assert.equal(getProgress(0), 100);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getQueueStatus, parseQueueWait } from '../wait-data-utils.js';

test('only accepts valid numeric Queue-Times waits', () => {
  assert.equal(parseQueueWait(0), 0);
  assert.equal(parseQueueWait('45'), 45);
  assert.equal(parseQueueWait(null), null);
  assert.equal(parseQueueWait('unknown'), null);
  assert.equal(parseQueueWait(-1), null);
});

test('honors source ride statuses before any reported wait value', () => {
  assert.equal(getQueueStatus({ sourceStatus: 'Closed', isOpen: true }), 'Closed');
  assert.equal(getQueueStatus({ sourceStatus: 'Down', isOpen: true }), 'Down');
  assert.equal(getQueueStatus({ sourceStatus: 'Unknown', isOpen: false }), 'Data unavailable');
  assert.equal(getQueueStatus({ sourceStatus: '', isOpen: false }), 'Closed');
  assert.equal(getQueueStatus({ sourceStatus: '', isOpen: true }), 'Open');
  assert.equal(getQueueStatus({ sourceStatus: '', isOpen: null }), 'Data unavailable');
});

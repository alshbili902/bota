import assert from 'node:assert';
import test from 'node:test';
import {
  formatBytes,
  formatDuration,
  formatEta,
  formatSpeed,
} from '../src/utils/file-utils.js';

test('Format utilities - formatBytes', () => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(500), '500 B');
  assert.strictEqual(formatBytes(1024), '1 KB');
  assert.strictEqual(formatBytes(1048576), '1 MB');
  assert.strictEqual(formatBytes(52428800), '50 MB');
  assert.strictEqual(formatBytes(1073741824), '1 GB');
});

test('Format utilities - formatDuration', () => {
  assert.strictEqual(formatDuration(0), '00:00');
  assert.strictEqual(formatDuration(45), '00:45');
  assert.strictEqual(formatDuration(65), '01:05');
  assert.strictEqual(formatDuration(3665), '01:01:05');
});

test('Format utilities - formatSpeed', () => {
  assert.strictEqual(formatSpeed(0), '0 KB/s');
  assert.strictEqual(formatSpeed(1048576), '1 MB/s');
  assert.strictEqual(formatSpeed(5242880), '5 MB/s');
});

test('Format utilities - formatEta', () => {
  assert.strictEqual(formatEta(-1), '--:--');
  assert.strictEqual(formatEta(25), '00:25');
  assert.strictEqual(formatEta(90), '01:30');
});

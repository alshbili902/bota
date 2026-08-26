import assert from 'node:assert';
import test from 'node:test';
import {
  isPrivateIp,
  isSafeUrl,
  isValidUrl,
  sanitizeFilename,
  sanitizeLogUrl,
} from '../src/utils/sanitizer.js';

test('Sanitizer - isValidUrl', () => {
  assert.strictEqual(isValidUrl('https://example.com/video.mp4'), true);
  assert.strictEqual(isValidUrl('http://sub.domain.org/watch?v=123'), true);
  assert.strictEqual(isValidUrl('ftp://ftp.example.com/file'), false);
  assert.strictEqual(isValidUrl('file:///etc/passwd'), false);
  assert.strictEqual(isValidUrl('javascript:alert(1)'), false);
  assert.strictEqual(isValidUrl('not_a_url'), false);
});

test('Sanitizer - isPrivateIp blocks internal addresses', () => {
  assert.strictEqual(isPrivateIp('127.0.0.1'), true);
  assert.strictEqual(isPrivateIp('10.0.0.5'), true);
  assert.strictEqual(isPrivateIp('172.16.1.1'), true);
  assert.strictEqual(isPrivateIp('192.168.1.100'), true);
  assert.strictEqual(isPrivateIp('169.254.169.254'), true); // AWS / Cloud metadata
  assert.strictEqual(isPrivateIp('0.0.0.0'), true);
  assert.strictEqual(isPrivateIp('::1'), true);
  assert.strictEqual(isPrivateIp('fe80::1'), true);

  // Public IPs
  assert.strictEqual(isPrivateIp('8.8.8.8'), false);
  assert.strictEqual(isPrivateIp('1.1.1.1'), false);
  assert.strictEqual(isPrivateIp('140.82.121.3'), false);
});

test('Sanitizer - isSafeUrl blocks SSRF threats', async () => {
  assert.strictEqual(await isSafeUrl('http://127.0.0.1:8080/admin'), false);
  assert.strictEqual(await isSafeUrl('http://localhost/secret'), false);
  assert.strictEqual(await isSafeUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.strictEqual(await isSafeUrl('http://192.168.1.1/router'), false);
  assert.strictEqual(await isSafeUrl('http://10.10.10.10/internal'), false);
  assert.strictEqual(await isSafeUrl('file:///etc/hosts'), false);
});

test('Sanitizer - sanitizeFilename prevents path traversal and illegal chars', () => {
  // Path traversal
  const traversal1 = sanitizeFilename('../../etc/passwd');
  assert.strictEqual(traversal1.includes('/'), false);
  assert.strictEqual(traversal1.includes('\\'), false);
  assert.strictEqual(traversal1.startsWith('..'), false);

  const traversal2 = sanitizeFilename('..\\..\\Windows\\System32\\cmd.exe');
  assert.strictEqual(traversal2.includes('/'), false);
  assert.strictEqual(traversal2.includes('\\'), false);

  // Windows illegal characters: < > : " / \ | ? *
  const dirty = 'My:Special<Video>*Title?2026".mp4';
  const clean = sanitizeFilename(dirty);
  assert.strictEqual(/[<>:"/\\|?*]/.test(clean), false);
  assert.strictEqual(clean.endsWith('.mp4'), true);

  // Blank/dot inputs
  const dotOnly = sanitizeFilename('...');
  assert.ok(dotOnly.length > 0);
  assert.ok(!dotOnly.startsWith('...'));
});

test('Sanitizer - sanitizeLogUrl strips sensitive tokens and queries', () => {
  const urlWithToken = 'https://example.com/media/file.mp4?auth=secret_token&key=12345#hash';
  const safe = sanitizeLogUrl(urlWithToken);
  assert.strictEqual(safe, 'https://example.com/media/file.mp4');
  assert.strictEqual(safe.includes('secret_token'), false);
});

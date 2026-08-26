import assert from 'node:assert';
import test from 'node:test';
import { QueueManager } from '../src/services/queue-manager.js';
import { DownloadTask } from '../src/types/download.js';

test('QueueManager - single active download per user', async () => {
  const queue = new QueueManager();
  const userId1 = 111111;
  const userId2 = 222222;

  const mockTask1: DownloadTask = {
    id: 'task1',
    userId: userId1,
    chatId: 123,
    metadata: {
      url: 'https://example.com/v1',
      title: 'Video 1',
      provider: 'ytdlp',
      formats: [],
    },
    selectedFormat: { id: 'best', label: 'Best', extension: 'mp4', isAudioOnly: false },
    abortController: new AbortController(),
    status: 'downloading',
    progress: { percent: 10, downloadedBytes: 100, phase: 'downloading' },
    tempDir: './temp/test_task1',
    startTime: Date.now(),
  };

  const mockTask1Duplicate: DownloadTask = {
    ...mockTask1,
    id: 'task1_dup',
  };

  const mockTask2: DownloadTask = {
    ...mockTask1,
    id: 'task2',
    userId: userId2,
  };

  assert.strictEqual(queue.hasActiveDownload(userId1), false);

  // Register first download for user 1
  const registered1 = queue.registerDownload(mockTask1);
  assert.strictEqual(registered1, true);
  assert.strictEqual(queue.hasActiveDownload(userId1), true);

  // Attempt duplicate download for user 1
  const registeredDuplicate = queue.registerDownload(mockTask1Duplicate);
  assert.strictEqual(registeredDuplicate, false, 'Duplicate download for same user must be rejected');

  // User 2 should be allowed their own download concurrently
  const registered2 = queue.registerDownload(mockTask2);
  assert.strictEqual(registered2, true, 'Different user must be permitted to download');

  // Cancel user 1
  const cancelled = await queue.cancelUserDownload(userId1);
  assert.strictEqual(cancelled, true);
  assert.strictEqual(mockTask1.abortController.signal.aborted, true, 'AbortSignal must be triggered');
  assert.strictEqual(queue.hasActiveDownload(userId1), false);

  // User 2 is still active
  assert.strictEqual(queue.hasActiveDownload(userId2), true);

  // Clean up user 2
  queue.removeDownload(userId2, 'task2');
  assert.strictEqual(queue.hasActiveDownload(userId2), false);
});

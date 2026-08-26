import assert from 'node:assert';
import test from 'node:test';
import { HttpProvider } from '../src/downloader/http-provider.js';
import { ProviderRegistry } from '../src/downloader/provider-registry.js';
import { YtDlpProvider } from '../src/downloader/ytdlp-provider.js';

test('ProviderRegistry - selects appropriate provider', async () => {
  const registry = new ProviderRegistry();

  const directProvider = await registry.getProviderForUrl('https://example.com/files/document.pdf');
  assert.ok(directProvider instanceof HttpProvider, 'Direct file URL should match HttpProvider');

  const mp4Provider = await registry.getProviderForUrl('https://example.com/video.mp4');
  assert.ok(mp4Provider instanceof HttpProvider, 'Direct mp4 should match HttpProvider');

  const youtubeProvider = await registry.getProviderForUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.ok(youtubeProvider instanceof YtDlpProvider, 'Video portal URL should match YtDlpProvider');

  const twitterProvider = await registry.getProviderForUrl('https://x.com/user/status/123456789');
  assert.ok(twitterProvider instanceof YtDlpProvider, 'Social media/web URL should match YtDlpProvider');
});

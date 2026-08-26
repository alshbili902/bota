import { DownloadProvider } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { HttpProvider } from './http-provider.js';
import { YtDlpProvider } from './ytdlp-provider.js';

export class ProviderRegistry {
  private providers: DownloadProvider[] = [];

  constructor() {
    // Register default providers in priority order
    // Specific direct HTTP files first, then yt-dlp for media platforms and fallback
    this.register(new HttpProvider());
    this.register(new YtDlpProvider());
  }

  /**
   * Register a new download provider
   */
  public register(provider: DownloadProvider): void {
    this.providers.push(provider);
    logger.debug({ provider: provider.name }, 'Registered download provider');
  }

  /**
   * Resolve the appropriate provider for a given URL
   */
  public async getProviderForUrl(url: string): Promise<DownloadProvider | null> {
    for (const provider of this.providers) {
      try {
        if (await provider.canHandle(url)) {
          return provider;
        }
      } catch (err) {
        logger.debug({ provider: provider.name, error: (err as Error).message }, 'Provider canHandle check failed');
      }
    }
    return null;
  }

  /**
   * Get provider by exact name (e.g. 'http', 'ytdlp')
   */
  public getProviderByName(name: string): DownloadProvider | null {
    return this.providers.find((p) => p.name === name) || null;
  }
}

export const providerRegistry = new ProviderRegistry();

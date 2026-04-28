import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';

export type NewsCategory = 'press_release' | 'updates' | 'case_law';

interface Source {
  id: string;
  name: string;
  /** Used as the floor category if heuristics can't classify an item. */
  defaultCategory: NewsCategory;
  url: string;
  /** Optional homepage shown alongside each item, separate from the article URL. */
  homepage?: string;
}

// External RSS feeds. URLs change — watch the "Failed to fetch <name>" log line
// and update here. Stable ids preserve cache across URL fixes.
//
// Many Indian-tax sources publish all content into a single feed but tag items.
// We classify per-item via `categorize()` below so one feed can populate all
// three UI categories (Press Releases / Updates / Case Laws).
const SOURCES: Source[] = [
  {
    id: 'taxguru_general',
    name: 'TaxGuru',
    defaultCategory: 'updates',
    url: 'https://taxguru.in/feed/',
    homepage: 'https://taxguru.in/',
  },
  {
    id: 'taxguru_income_tax',
    name: 'TaxGuru — Income Tax',
    defaultCategory: 'updates',
    url: 'https://taxguru.in/category/income-tax/feed/',
    homepage: 'https://taxguru.in/category/income-tax/',
  },
];

/**
 * Per-item classifier. Uses item title + RSS-provided <category> tags to
 * assign one of the three UI categories. Order matters — case-law signals
 * are checked before press-release signals because "judgement" is more
 * specific than "press release".
 */
function categorize(
  title: string,
  itemCategories: string[],
  fallback: NewsCategory,
): NewsCategory {
  const haystack = (title + ' || ' + itemCategories.join(' || ')).toLowerCase();

  // Case law / judiciary FIRST — a strong forum signal (ITAT, Tribunal, HC,
  // SC) wins even if the article also mentions a CBDT circular in passing.
  // We deliberately do NOT match plain " vs " here because that fires on
  // generic comparisons like "Old vs New regime".
  if (
    /\b(judg(e)?ment|judiciary|itat\b|nclt\b|cestat\b|aaar\b|\baar ruling|tribunal\b|high court|supreme court|hc held|sc held|hon'?ble|delhi hc|bombay hc|madras hc|allahabad hc|case law)\b/i.test(
      haystack,
    )
  ) {
    return 'case_law';
  }

  // Press release / circular / notification — official communications.
  if (
    /\b(press release|press note|circular(?: no)?\b|notification(?: no)?\b|cbdt|cbic|gst council|ministry of finance|union budget|press info|pib\b)/i.test(
      haystack,
    )
  ) {
    return 'press_release';
  }

  return fallback;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — be polite to sources
const FETCH_TIMEOUT_MS = 8000;
const ITEMS_PER_SOURCE = 30;
const SUMMARY_LEN = 240;

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  publishedAt: string;
  url: string;
  sourceId: string;
  sourceName: string;
  sourceHomepage?: string;
  category: NewsCategory;
}

interface CacheEntry {
  fetchedAt: number;
  items: NewsItem[];
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&[a-z]+;/gi, ' ') // anything else — drop entity
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private parser = new Parser({ timeout: FETCH_TIMEOUT_MS });
  private cache = new Map<string, CacheEntry>();

  async fetchAll(opts: { force?: boolean } = {}): Promise<NewsItem[]> {
    const results = await Promise.allSettled(
      SOURCES.map((s) => this.fetchSource(s, opts.force ?? false)),
    );
    // Dedupe by article URL — overlapping feeds (e.g. TaxGuru main + TaxGuru
    // Income Tax) often republish the same post. Keep the first occurrence.
    const seen = new Set<string>();
    const all: NewsItem[] = [];
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const item of r.value) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        all.push(item);
      }
    }
    all.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
    return all;
  }

  /**
   * Per-source health snapshot — useful for the UI to show "this source last
   * fetched at HH:MM" or warn the user when something has been stale for a while.
   */
  status() {
    return SOURCES.map((s) => {
      const c = this.cache.get(s.id);
      return {
        id: s.id,
        name: s.name,
        homepage: s.homepage,
        lastFetchedAt: c ? new Date(c.fetchedAt).toISOString() : null,
        itemCount: c?.items.length ?? 0,
      };
    });
  }

  private async fetchSource(source: Source, force: boolean): Promise<NewsItem[]> {
    const cached = this.cache.get(source.id);
    const now = Date.now();
    if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.items;
    }

    try {
      const feed = await this.parser.parseURL(source.url);
      const items: NewsItem[] = (feed.items ?? [])
        .slice(0, ITEMS_PER_SOURCE)
        .map((item, idx) => {
          const raw =
            (item.content as string | undefined) ??
            (item['content:encoded'] as string | undefined) ??
            item.contentSnippet ??
            item.summary ??
            '';
          const fullText = stripHtml(raw);
          const summary =
            fullText.length > SUMMARY_LEN ? fullText.slice(0, SUMMARY_LEN).trim() + '…' : fullText;
          const title = stripHtml(item.title ?? '(untitled)');
          const itemCats = (item.categories ?? []) as string[];
          return {
            id: `${source.id}_${idx}_${item.guid ?? item.link ?? item.title ?? idx}`.slice(0, 200),
            title,
            summary,
            fullText,
            publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
            url: item.link ?? source.url,
            sourceId: source.id,
            sourceName: source.name,
            sourceHomepage: source.homepage,
            category: categorize(title, itemCats, source.defaultCategory),
          };
        });
      this.cache.set(source.id, { fetchedAt: now, items });
      this.logger.log(`Refreshed ${source.name}: ${items.length} items`);
      return items;
    } catch (e) {
      this.logger.warn(`Failed to fetch ${source.name}: ${(e as Error).message}`);
      // If we have stale cache, serve it; otherwise empty.
      return cached?.items ?? [];
    }
  }
}

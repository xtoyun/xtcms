import { getContent } from './content';

interface KeywordRule {
  keyword: string;
  link: string;
}

let keywordsCache: KeywordRule[] | null = null;
let cacheTime = 0;

function getKeywords(): KeywordRule[] {
  if (keywordsCache && Date.now() - cacheTime < 10000) {
    return keywordsCache;
  }
  keywordsCache = getContent('keywords', 'src/content/keywords')
    .map(k => ({ keyword: k.data.keyword, link: k.data.link }))
    .filter(k => k.keyword && k.link);
  cacheTime = Date.now();
  return keywordsCache;
}

/**
 * Auto-link first 3 occurrences of each keyword in HTML.
 * Skips existing <a> tags, headings, and code blocks.
 */
export function autoLinkKeywords(html: string): string {
  const keywords = getKeywords();
  if (!keywords.length || !html) return html;

  const parts = html.split(/(<[^>]+>)/g);
  const skipTags = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'script', 'style']);
  let skipDepth = 0;
  const counts: Record<string, number> = {};

  return parts.map(part => {
    if (part.startsWith('<')) {
      const endMatch = part.match(/^<\/(\w+)/);
      if (endMatch && skipTags.has(endMatch[1].toLowerCase())) {
        skipDepth = Math.max(0, skipDepth - 1);
      } else {
        const openMatch = part.match(/^<(\w+)/);
        if (openMatch && skipTags.has(openMatch[1].toLowerCase())) {
          skipDepth++;
        }
      }
      return part;
    }

    if (skipDepth > 0) return part;

    let text = part;
    for (const kw of keywords) {
      const k = counts[kw.keyword] || 0;
      if (k >= 3) continue;

      const escaped = kw.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      let replaced = 0;
      const limit = 3 - k;

      text = text.replace(regex, match => {
        if (replaced >= limit) return match;
        replaced++;
        counts[kw.keyword] = (counts[kw.keyword] || 0) + 1;
        return `<a href="${kw.link}" class="kw-link" target="_blank" rel="noopener" title="${kw.keyword}">${match}</a>`;
      });
    }

    return text;
  }).join('');
}

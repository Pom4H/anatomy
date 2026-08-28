import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../config';

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const slugOf = (id: string) => id.replace(/\.(md|mdx)$/i, '');

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('astro.config.mjs must define site');

  const base = import.meta.env.BASE_URL;
  const articles = (await getCollection('articles', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
  );
  const channelUrl = new URL(base, site);

  const items = articles
    .map((article) => {
      const url = new URL(`${base}${slugOf(article.id)}/`, site);
      return `
        <item>
          <title>${escapeXml(article.data.title)}</title>
          <description>${escapeXml(article.data.description)}</description>
          <link>${url.href}</link>
          <guid isPermaLink="true">${url.href}</guid>
          <pubDate>${article.data.publishedAt.toUTCString()}</pubDate>
        </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>${escapeXml(SITE.name)}</title>
        <description>${escapeXml(SITE.description)}</description>
        <link>${channelUrl.href}</link>
        <language>${SITE.language}</language>
        ${items}
      </channel>
    </rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};

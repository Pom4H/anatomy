import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const slugOf = (id: string) => id.replace(/\.(md|mdx)$/i, '');

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('astro.config.mjs must define site');

  const base = import.meta.env.BASE_URL;
  const articles = (await getCollection('articles', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
  );

  const urls = [
    {
      loc: new URL(base, site).href,
      lastmod: articles[0]?.data.updatedAt ?? articles[0]?.data.publishedAt,
      priority: '1.0',
    },
    ...articles.map((article) => ({
      loc: new URL(`${base}${slugOf(article.id)}/`, site).href,
      lastmod: article.data.updatedAt ?? article.data.publishedAt,
      priority: '0.9',
    })),
  ];

  const body = urls
    .map(
      ({ loc, lastmod, priority }) => `
        <url>
          <loc>${loc}</loc>
          ${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}
          <changefreq>monthly</changefreq>
          <priority>${priority}</priority>
        </url>`,
    )
    .join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};

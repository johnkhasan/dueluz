import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing under these paths is useful to index, and /admin must never
        // appear in results even though it is already access-controlled.
        disallow: ['/api/', '/admin', '/*/admin', '/*/settings', '/*/my'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}

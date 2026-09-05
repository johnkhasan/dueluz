import { ImageResponse } from 'next/og';
import { getDictionary } from '@/lib/i18n/dictionary';
import { isLocale } from '@/lib/i18n/config';

export const runtime = 'nodejs';
export const alt = 'Duel.uz';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default share image for every non-duel page. */
export default async function OpengraphImage({ params }: { params: { locale: string } }) {
  const t = getDictionary(isLocale(params.locale) ? params.locale : 'uz');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a12',
          color: 'white',
          fontFamily: 'sans-serif',
          textAlign: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 132,
            height: 132,
            borderRadius: 34,
            background: 'linear-gradient(115deg, #6366f1, #a855f7, #f43f5e)',
            fontSize: 50,
            fontWeight: 900,
            letterSpacing: 2,
          }}
        >
          VS
        </div>

        <div
          style={{ display: 'flex', fontSize: 78, fontWeight: 900, marginTop: 36, letterSpacing: -2 }}
        >
          DUEL.UZ
        </div>
        <div
          style={{ display: 'flex', fontSize: 34, color: '#a0a0b8', marginTop: 16, maxWidth: 900 }}
        >
          {t.home.heroSubtitle}
        </div>
      </div>
    ),
    size,
  );
}

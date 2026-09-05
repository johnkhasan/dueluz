import { ImageResponse } from 'next/og';
import { prisma } from '@dueluz/db';
import { votePercentages } from '@/lib/utils';

export const runtime = 'nodejs';
export const alt = 'Duel.uz';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Per-duel share image.
 *
 * This is the single highest-leverage growth surface: it is what a person sees
 * in a Telegram or X feed before deciding whether to open the link. It shows
 * the matchup, not the brand, so the question itself does the selling.
 */
export default async function OpengraphImage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const duel = await prisma.duel.findUnique({
    where: { slug: params.slug },
    select: {
      title: true,
      voteCount: true,
      category: { select: { emoji: true } },
      options: { orderBy: { position: 'asc' }, select: { name: true, voteCount: true } },
    },
  });

  const optionA = duel?.options[0]?.name ?? 'Duel';
  const optionB = duel?.options[1]?.name ?? 'Uz';
  const [percentA, percentB] = votePercentages(
    duel?.options[0]?.voteCount ?? 0,
    duel?.options[1]?.voteCount ?? 0,
  );
  const hasVotes = (duel?.voteCount ?? 0) > 0;

  // Long names must still fit: step the type down instead of clipping.
  const nameSize = Math.max(optionA.length, optionB.length) > 18 ? 52 : 70;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a12',
          fontFamily: 'sans-serif',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '40px 56px 0',
            fontSize: 30,
            fontWeight: 700,
            color: '#a0a0b8',
          }}
        >
          <span>{duel?.category.emoji ?? '⚔️'}</span>
          <span style={{ marginLeft: 14, maxWidth: 1000, overflow: 'hidden' }}>
            {(duel?.title ?? 'Duel.uz').slice(0, 70)}
          </span>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', position: 'relative' }}>
          <Side name={optionA} percent={percentA} show={hasVotes} accent="#6366f1" size={nameSize} align="flex-start" />

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 116,
              height: 116,
              borderRadius: 999,
              background: 'linear-gradient(115deg, #6366f1, #a855f7, #f43f5e)',
              border: '8px solid #0a0a12',
              fontSize: 38,
              fontWeight: 900,
              letterSpacing: 2,
            }}
          >
            VS
          </div>

          <Side name={optionB} percent={percentB} show={hasVotes} accent="#f43f5e" size={nameSize} align="flex-end" />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 56px 40px',
            fontSize: 28,
            color: '#6f6f88',
            fontWeight: 700,
          }}
        >
          <span>
            {hasVotes ? `${(duel?.voteCount ?? 0).toLocaleString('en-US')} votes` : 'Be the first to vote'}
          </span>
          <span style={{ color: 'white', fontWeight: 900, letterSpacing: -0.5 }}>DUEL.UZ</span>
        </div>
      </div>
    ),
    size,
  );
}

function Side({
  name,
  percent,
  show,
  accent,
  size,
  align,
}: {
  name: string;
  percent: number;
  show: boolean;
  accent: string;
  size: number;
  align: 'flex-start' | 'flex-end';
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align,
        justifyContent: 'center',
        width: '50%',
        height: '100%',
        padding: align === 'flex-start' ? '0 90px 0 56px' : '0 56px 0 90px',
        textAlign: align === 'flex-start' ? 'left' : 'right',
      }}
    >
      {show ? (
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 900, color: accent, lineHeight: 1 }}>
          {`${percent}%`}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.1,
          marginTop: show ? 14 : 0,
          maxWidth: '100%',
        }}
      >
        {name.slice(0, 42)}
      </div>
    </div>
  );
}

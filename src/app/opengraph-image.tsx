import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import brand from '@/styles/brand.json';

export const alt = 'Dash the Data – From messy data to a dashboard in a minute.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const fontDir = join(process.cwd(), 'src/assets/fonts');

/** 1200×630, Mist background, horizontal logo and one sentence (17.3). English by default. */
export default async function Image() {
  const [bold, medium] = await Promise.all([
    readFile(join(fontDir, 'BricolageGrotesque-Bold.ttf')),
    readFile(join(fontDir, 'BricolageGrotesque-Medium.ttf')),
  ]);
  const accent = brand.accent;
  const ink = brand.ink;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: brand.mist,
        fontFamily: 'Bricolage',
        gap: 48,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <svg width="150" height="150" viewBox="0 0 120 120">
          <rect x="9" y="58" width="14" height="14" rx="3" transform="rotate(-20 16 65)" fill={accent} />
          <circle cx="30" cy="38" r="7" fill={accent} />
          <rect
            x="19"
            y="85"
            width="11"
            height="11"
            rx="2.5"
            transform="rotate(14 24.5 90.5)"
            fill={accent}
          />
          <rect x="46" y="66" width="17" height="38" rx="4" fill={ink} />
          <rect x="70" y="45" width="17" height="59" rx="4" fill={ink} />
          <rect x="94" y="22" width="17" height="82" rx="4" fill={ink} />
        </svg>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            color: ink,
            fontSize: 124,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          <span>Dash</span>
          <span style={{ fontSize: 62, fontWeight: 500, margin: '0 0.12em', letterSpacing: 0 }}>the</span>
          <span>Data</span>
        </div>
      </div>
      <div style={{ display: 'flex', color: '#4A5878', fontSize: 44, fontWeight: 500 }}>
        From messy data to a dashboard in a minute.
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Bricolage', data: bold, style: 'normal', weight: 700 },
        { name: 'Bricolage', data: medium, style: 'normal', weight: 500 },
      ],
    },
  );
}

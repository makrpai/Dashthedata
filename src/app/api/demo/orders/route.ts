import { NextResponse } from 'next/server';

/** Small public demo payload so the HTTP connector can be tried without an external API. */
export function GET() {
  return NextResponse.json([
    { region: 'Helsinki', month: '2025-01-01', sales: 1280 },
    { region: 'Tampere', month: '2025-01-01', sales: 860 },
    { region: 'Helsinki', month: '2025-02-01', sales: 1430 },
    { region: 'Turku', month: '2025-02-01', sales: 640 },
  ]);
}

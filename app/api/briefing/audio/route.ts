import { promises as fs } from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/store';

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!/^[\w-]+$/.test(key)) return new Response('Bad key', { status: 400 });
  try {
    const buf = await fs.readFile(path.join(DATA_DIR, 'audio', `${key}.mp3`));
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' } });
  } catch { return new Response('Not found', { status: 404 }); }
}

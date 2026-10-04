import { NextResponse } from 'next/server';
import { deleteSource } from '@/lib/store';

// Undoes an ingest: drops the source and every commitment it created, history included.
// The way back from a transcript that extracted badly, without resetting the whole store.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await deleteSource(id);
  return r ? NextResponse.json({ ok: true, id, ...r }) : NextResponse.json({ error: 'Unknown source' }, { status: 404 });
}

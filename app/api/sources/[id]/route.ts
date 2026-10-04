import { NextResponse } from 'next/server';
import { deleteSource } from '@/lib/store';

// Undo for a bad paste: removes the source and every item extracted from it.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return NextResponse.json(await deleteSource(id)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 404 }); }
}

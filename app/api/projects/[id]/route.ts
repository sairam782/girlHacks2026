import { NextResponse } from 'next/server';
import { deleteProject } from '@/lib/store';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return NextResponse.json(await deleteProject(id)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 404 }); }
}

import { NextResponse } from 'next/server';
import { deleteProject } from '@/lib/store';
import { requireProjectDeleteCredentials } from '@/lib/project-delete-auth';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireProjectDeleteCredentials(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  try { return NextResponse.json(await deleteProject(id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) {
    if (e instanceof Error && e.message === 'Unknown project') return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    console.error('[projects] deletion failed', e);
    return NextResponse.json({ error: 'Could not delete the project. Please try again.' }, { status: 500 });
  }
}

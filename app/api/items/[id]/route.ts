import { NextResponse } from 'next/server';
import { deleteItem, patchItem, type ItemPatch } from '@/lib/store';
import { isDate } from '@/lib/dates';
import { fail, readJson } from '@/lib/http';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let b: Record<string, unknown>;
  try { b = await readJson(req); } catch (e) { return fail(e); }
  const p: ItemPatch = {};
  if (typeof b.text === 'string') p.text = b.text;
  if (b.owner === null || typeof b.owner === 'string') p.owner = b.owner && b.owner.trim() ? b.owner.trim() : null;
  if (b.deadline === null || b.deadline === '') p.deadline = null;
  else if (b.deadline !== undefined) { if (!isDate(b.deadline)) return NextResponse.json({ error: 'Bad date' }, { status: 400 }); p.deadline = b.deadline; }
  if (typeof b.done === 'boolean') p.done = b.done;
  if (b.nudge === true) p.nudge = true;
  if (b.type === 'action') p.type = 'action';
  try { return NextResponse.json(await patchItem(id, p)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 404 }); }
}

// Removes a commitment outright, with its history. Used to undo a bad extraction.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return (await deleteItem(id))
    ? NextResponse.json({ ok: true, id })
    : NextResponse.json({ error: 'Unknown item' }, { status: 404 });
}

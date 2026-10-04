import { NextResponse } from 'next/server';
import { createProject } from '@/lib/store';
import { fail, readJson } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const { name } = await readJson<{ name?: unknown }>(req);
    if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    return NextResponse.json(await createProject(name));
  } catch (e) { return fail(e); }
}

import { NextResponse } from 'next/server';
import { createProject } from '@/lib/store';

export async function POST(req: Request) {
  const { name } = await req.json();
  if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  return NextResponse.json(await createProject(name));
}

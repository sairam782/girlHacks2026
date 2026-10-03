// Mood Mirror demo meetings.
//
// When the Python service is up, the demo runs there so the report carries an analysis id — that
// id is what the face layer and the spoken brief need. The "Sprint check-in" demo also comes back
// with a simulated face layer, clearly labelled, so the face feature can be shown without a webcam.
//
// With the service down, the same transcripts are analysed in-process by engine.ts, so the demo
// always works. Face and brief are simply unavailable in that case.

import { addSuggestions, labelTurns } from '@/components/canopy/mood/azure';
import { analyzeTurns, EmptyMeetingError } from '@/components/canopy/mood/engine';
import { MEETINGS } from '@/components/canopy/mood/meetings';
import { relay, serviceFetch } from '@/components/canopy/mood/service';
import { MEETING_LABELS, type MeetingId } from '@/components/canopy/mood/types';

/** The service's own /api/demo is the sprint meeting, plus its simulated face layer. */
async function viaService(key: MeetingId) {
  if (key === 'sprint') return serviceFetch('/api/demo', {}, 60_000);

  // The vendor standup is Canopy's own transcript, so hand it over as an upload.
  const meeting = MEETINGS[key];
  const form = new FormData();
  form.append('transcript', new File([JSON.stringify(meeting)], 'vendor_standup.json', { type: 'application/json' }));
  return serviceFetch('/api/analyze', { method: 'POST', body: form }, 60_000);
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('meeting') ?? 'vendor';
  if (!(key in MEETING_LABELS)) return Response.json({ error: `Unknown demo meeting "${key}"` }, { status: 400 });
  const meeting = MEETINGS[key as MeetingId];

  try {
    const res = await viaService(key as MeetingId);
    if (res.ok) return relay(res);
    console.error(`[mood] service demo returned ${res.status}; analysing in-process instead`);
  } catch {
    // Service not running: fall through to the built-in engine.
  }

  try {
    const report = await analyzeTurns(meeting.turns, meeting.title, 'demo transcript', {
      labelTurns,
      suggest: addSuggestions,
    });
    return Response.json(report);
  } catch (e) {
    if (e instanceof EmptyMeetingError) return Response.json({ error: e.message }, { status: 400 });
    console.error('[mood] demo failed:', e);
    return Response.json({ error: 'Could not analyze the demo meeting.' }, { status: 500 });
  }
}

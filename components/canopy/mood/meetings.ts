// The demo transcripts, shared with the Python service in mood-mirror/sample/.
// Server-side only: importing this from a client component would bundle both transcripts.
// The picker in MoodMirror.tsx uses MEETING_LABELS from types.ts instead.

import sprintCheckin from '@/mood-mirror/sample/demo_meeting.json';
import vendorStandup from '@/mood-mirror/sample/vendor_standup.json';
import type { MeetingId } from './types';

export const MEETINGS: Record<MeetingId, { title: string; turns: unknown }> = {
  vendor: vendorStandup,
  sprint: sprintCheckin,
};

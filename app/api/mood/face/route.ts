// The opt-in face layer: one person's own video, read to find moments where their words and their
// expression disagree. The service refuses without consent, runs the model locally, and deletes the
// uploaded video as soon as it has finished with it.

import { relay, serviceFetch, START_SERVICE_HINT } from '@/components/canopy/mood/service';

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Send the video as multipart/form-data.' }, { status: 400 });
  }

  if (form.get('consent') !== 'true') {
    return Response.json({ error: 'Face analysis needs the person to opt in first.' }, { status: 400 });
  }
  if (!form.get('analysis_id') || !form.get('speaker')) {
    return Response.json({ error: 'Run the meeting analysis again, then add the face layer.' }, { status: 400 });
  }

  try {
    const res = await serviceFetch('/api/face', { method: 'POST', body: form });
    return relay(res);
  } catch {
    return Response.json({ error: `The face layer needs the Mood Mirror service. ${START_SERVICE_HINT}` }, { status: 503 });
  }
}

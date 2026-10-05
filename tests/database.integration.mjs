// Run against two local servers sharing an isolated CANOPY_STORE_KEY in PostgreSQL.
// The test creates and removes only its own synthetic projects.
import assert from 'node:assert/strict';

const bases = [process.env.CANOPY_TEST_BASE_URL, process.env.CANOPY_TEST_PEER_URL];
if (bases.some((base) => !base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname))) {
  throw new Error('Provide two localhost test servers; this test must not target production.');
}
const credentials = { username: process.env.CANOPY_DELETE_USERNAME, password: process.env.CANOPY_DELETE_PASSWORD };
assert.ok(credentials.username && credentials.password, 'Test deletion credentials are required.');
const ids = [];
const request = async (base, path, method = 'GET', body) => {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${result.error || ''}`);
  return result;
};

try {
  const initial = await request(bases[0], '/api/state');
  assert.equal(initial.engines.database, true);
  assert.equal(initial.engines.tiger, false, 'Replacement database must bypass legacy Timescale.');
  const projects = await Promise.all(Array.from({ length: 8 }, async (_, i) => {
    const project = await request(bases[i % 2], '/api/projects', 'POST', { name: `DB integration ${Date.now()} ${i}` });
    ids.push(project.id);
    return project;
  }));
  const state = await request(bases[1], '/api/state');
  for (const project of projects) assert.ok(state.projects.some((p) => p.id === project.id), 'Concurrent project write was lost.');
  const projectId = projects[0].id;
  await request(bases[0], '/api/ingest', 'POST', {
    projectId, text: 'Test Owner will verify the database.', title: 'Synthetic database check',
    items: [{ type: 'action', text: 'Verify the database', owner: 'Test Owner', deadline: null, source_excerpt: 'Test Owner will verify the database.' }],
  });
  const ingested = await request(bases[1], '/api/state');
  const item = ingested.items.find((i) => i.project_id === projectId);
  assert.ok(item, 'Source/item must be visible from another process.');
  await Promise.all([
    request(bases[0], `/api/items/${item.id}`, 'PATCH', { text: 'Verified concurrent editing' }),
    request(bases[1], `/api/items/${item.id}`, 'PATCH', { owner: 'Another Test Owner' }),
  ]);
  await request(bases[1], `/api/items/${item.id}`, 'PATCH', { done: true });
  const updated = await request(bases[0], '/api/state');
  const edited = updated.items.find((i) => i.id === item.id);
  assert.equal(edited.text, 'Verified concurrent editing');
  assert.equal(edited.status, 'done');
  assert.equal(updated.people.find((p) => p.id === edited.owner_id).name, 'Another Test Owner');
  const history = await request(bases[1], `/api/history?projectId=${projectId}`);
  for (const event of ['created', 'edited', 'reassigned', 'done']) assert.ok(history.events.some((e) => e.event_type === event), `Missing ${event} history.`);
  const denied = await fetch(`${bases[0]}/api/projects/${projectId}`, { method: 'DELETE' });
  assert.equal(denied.status, 401);
  assert.ok((await request(bases[1], '/api/state')).projects.some((p) => p.id === projectId));
  console.log('PASS: concurrent writes across processes, shared reads, ingestion, edits, completion, history, and deletion protection.');
} finally {
  for (const id of ids) await request(bases[0], `/api/projects/${id}`, 'DELETE', credentials);
  const remaining = await request(bases[1], '/api/state');
  assert.ok(!remaining.projects.some((p) => ids.includes(p.id)));
  assert.ok(!remaining.items.some((i) => ids.includes(i.project_id)));
  assert.ok(!remaining.sources.some((s) => ids.includes(s.project_id)));
  assert.ok(!remaining.events.some((e) => ids.includes(e.project_id)));
  console.log('PASS: authenticated cleanup removed only synthetic test projects and their dependent data.');
}

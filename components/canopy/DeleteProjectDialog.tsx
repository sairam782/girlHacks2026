'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

export function DeleteProjectDialog({ project, onCancel, onDeleted }: {
  project: { id: string; name: string };
  onCancel: () => void;
  onDeleted: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = await response.json().catch(() => ({}));
      setPassword('');
      if (!response.ok) throw new Error(body.error || 'Could not delete the project. Please try again.');
      await onDeleted();
    } catch (e) {
      setPassword('');
      setError(e instanceof Error ? e.message : 'Could not delete the project. Please try again.');
      setBusy(false);
    }
  };

  const field = { width: '100%', boxSizing: 'border-box', height: 42, border: '1px solid #dcdad0', borderRadius: 9, padding: '0 12px', font: 'inherit', color: '#1d2620', background: '#fff' } as const;
  const label = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#4a554e' } as const;

  return (
    <dialog ref={dialog} className="project-delete-dialog" aria-labelledby="delete-project-title" aria-describedby="delete-project-description"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      style={{ width: 'min(440px, calc(100vw - 32px))', boxSizing: 'border-box', border: '1px solid #e4e2d9', borderRadius: 18, padding: 24, background: '#fff', color: '#1d2620', boxShadow: '0 24px 60px rgba(40,55,45,.25)' }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 id="delete-project-title" style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 400, margin: 0 }}>Delete project?</h2>
        <p id="delete-project-description" style={{ fontSize: 13, lineHeight: 1.5, color: '#65706a', margin: 0 }}>Enter the administrator credentials to delete “{project.name}” and its sources, commitments, and history. This cannot be undone.</p>
        <label style={label}>Username<input autoFocus autoComplete="username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={100} required disabled={busy} style={field} /></label>
        <label style={label}>Password<input type="password" autoComplete="current-password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={256} required disabled={busy} style={field} /></label>
        {error && <p role="alert" style={{ margin: 0, color: '#9c4529', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #dcdad0', background: '#fff', cursor: busy ? 'wait' : 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy || !username.trim() || !password} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: 'none', background: '#9c4529', color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy || !username.trim() || !password ? .6 : 1 }}>{busy ? 'Deleting…' : 'Delete project'}</button>
        </div>
      </form>
    </dialog>
  );
}

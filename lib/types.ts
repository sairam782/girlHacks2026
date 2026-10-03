// Data model from the README: Project, Person, ActionItem, CommitmentEvent (plus Source for ingested text).
export type EventType = 'created' | 'reassigned' | 'deadline_moved' | 'edited' | 'done' | 'reopened' | 'overdue';
export type SourceKind = 'mtg' | 'chat' | 'doc';

export interface Project { id: string; name: string; created_at: string }
export interface Person { id: string; name: string; email?: string }
export interface Source {
  id: string; project_id: string; kind: SourceKind; title: string;
  meeting_date: string; text: string; created_at: string; extracted: number;
}
export interface ActionItem {
  id: string; project_id: string; source_id: string; owner_id: string | null;
  type: 'action' | 'decision'; text: string; deadline: string | null;
  status: 'open' | 'done'; source_excerpt: string; workstream: string;
  created_at: string; done_at: string | null;
}
export interface CommitmentEvent {
  time: string; action_item_id: string; project_id: string; event_type: EventType;
  old_value: string | null; new_value: string | null;
}
export interface AppState { projects: Project[]; people: Person[]; sources: Source[]; items: ActionItem[]; events: CommitmentEvent[] }

// Gemini extraction contract: one object per item.
export interface Extracted {
  type: 'action' | 'decision'; text: string; owner: string | null;
  deadline: string | null; source_excerpt: string; workstream?: string | null;
}

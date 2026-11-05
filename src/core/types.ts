export interface CalendarEvent {
  uid: string;
  /** Epoch milliseconds (UTC instant). */
  start: number;
  end: number;
  allDay: boolean;
  title: string;
  location: string;
  description: string;
  /** Best-effort course code guessed from the title, e.g. "DAT110". */
  courseCode?: string;
  /** Id of the Source this event came from. */
  sourceId: string;
}

export interface Source {
  id: string;
  name: string;
  /** Always an https:// ICS feed URL. */
  url: string;
  kind: 'personal' | 'course';
}

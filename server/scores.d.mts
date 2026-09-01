export interface ServerScoreEntry {
  nick: string;
  score: number;
  accuracy: number;
  correct: number;
  wrong: number;
  topicLabel: string;
  playedAt: number;
  date: string;
}

export interface ScoreBoard {
  today: string;
  board: ServerScoreEntry[];
}

export interface SavedScore extends ScoreBoard {
  entry: ServerScoreEntry;
  position: number;
}

export declare const MAX_ENTRIES: number;
export declare const MAX_NICK: number;

export declare function dayKey(now?: Date): string;
export declare function cleanNick(value: unknown): string;
export declare function sanitizeEntry(raw: unknown, now?: Date): ServerScoreEntry | null;
export declare function bestPerNick(entries: ServerScoreEntry[]): ServerScoreEntry[];

export declare class ScoreStore {
  constructor(file: string);
  read(now?: Date): Promise<ScoreBoard>;
  add(raw: unknown, now?: Date): Promise<SavedScore | null>;
}

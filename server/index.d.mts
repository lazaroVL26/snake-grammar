import type { Server } from 'node:http';
import type { ScoreStore } from './scores.mjs';

export declare function localAddresses(): string[];

export declare function startServer(options?: {
  port?: number;
  host?: string;
  file?: string;
}): Promise<{ server: Server; store: ScoreStore }>;

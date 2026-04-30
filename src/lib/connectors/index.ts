import { githubConnector } from "./github";
import { gmailConnector } from "./gmail";
import type { ConnectorDef } from "./types";

export const CONNECTORS: Record<string, ConnectorDef> = {
  github: githubConnector,
  gmail: gmailConnector,
};

export function getConnector(id: string): ConnectorDef | null {
  return CONNECTORS[id] ?? null;
}

export type { ConnectorDef, ConnectorAccount, ConnectorContext } from "./types";

import type { Tool } from "ai";

export interface ConnectorAccount {
  id?: string;
  login?: string;
  email?: string;
  name?: string;
}

export interface ConnectorContext {
  profileId: string;
}

export interface ConnectorDef {
  id: string; // "github" | "gmail" | ...
  displayName: string;
  scopes: string[];
  authUrl(opts: { clientId: string; redirectUri: string; state: string }): string;
  tokenExchange(opts: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string }>;
  refresh?(opts: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }>;
  fetchAccount(accessToken: string): Promise<ConnectorAccount>;
  buildTools(ctx: ConnectorContext, accessToken: string): Record<string, Tool>;
}

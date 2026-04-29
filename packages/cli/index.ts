#!/usr/bin/env bun
export {};

const BASE_URL = process.env.OPENMLC_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const API_KEY = process.env.OPENMLC_API_KEY ?? "";

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function usage(): never {
  console.error(`
openmlc — openmlc CLI

commands:
  chat "prompt" [--model <id>]   stream a chat completion to stdout
  chat --model <id>              read prompt from stdin, stream to stdout
  swarm "task"                   dispatch a swarm run (non-streaming)

env:
  OPENMLC_BASE_URL   base URL of your openmlc instance (default: http://localhost:3000)
  OPENMLC_API_KEY    API key (bearer token)
`.trim());
  process.exit(1);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function cmdChat(args: string[]) {
  let model = "gpt-4o";
  let prompt = "";

  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" || args[i] === "-m") {
      model = args[++i] ?? die("--model requires a value");
    } else {
      rest.push(args[i]);
    }
  }

  prompt = rest.join(" ").trim();

  if (!prompt) {

    if (process.stdin.isTTY) {
      process.stderr.write("prompt> ");
    }
    prompt = await readStdin();
  }

  if (!prompt) die("no prompt provided");

  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${API_KEY}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    die(`API error ${res.status}: ${text}`);
  }

  if (!res.body) die("no response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6);
      try {
        const chunk = JSON.parse(jsonStr) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) process.stdout.write(text);
      } catch {

      }
    }
  }

  process.stdout.write("\n");
}

async function cmdSwarm(args: string[]) {
  const task = args.join(" ").trim();
  if (!task) die("swarm requires a task description");

  const res = await fetch(`${BASE_URL}/api/swarm`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${API_KEY}`,

      "x-api-key": API_KEY,
    },
    body: JSON.stringify({ prompt: task }),
  });

  if (!res.ok) {
    const text = await res.text();
    die(`swarm API error ${res.status}: ${text}`);
  }

  if (!res.body) die("no response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6);
      if (jsonStr === "[DONE]") continue;

      try {
        const event = JSON.parse(jsonStr) as {
          type?: string;
          agentId?: string;
          content?: string;
          text?: string;
          status?: string;
        };
        if (event.type === "agent_delta" || event.type === "agent_done") {
          if (event.agentId) process.stdout.write(`\n[agent:${event.agentId}] `);
          if (event.content) process.stdout.write(event.content);
          if (event.text) process.stdout.write(event.text);
        } else if (event.type === "supervisor_delta" || event.type === "supervisor_done") {
          if (event.content) process.stdout.write(event.content);
          if (event.text) process.stdout.write(event.text);
        } else if (event.status) {
          process.stderr.write(`[swarm] ${event.status}\n`);
        }
      } catch {

      }
    }
  }

  process.stdout.write("\n");
}

const argv = process.argv.slice(2);
const cmd = argv[0];

if (!cmd || cmd === "--help" || cmd === "-h") usage();

if (!API_KEY) {
  process.stderr.write("warning: OPENMLC_API_KEY is not set\n");
}

switch (cmd) {
  case "chat":
    await cmdChat(argv.slice(1));
    break;
  case "swarm":
    await cmdSwarm(argv.slice(1));
    break;
  default:
    console.error(`unknown command: ${cmd}`);
    usage();
}

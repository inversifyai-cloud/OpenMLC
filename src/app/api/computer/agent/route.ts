import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const agentPath = join(process.cwd(), "agent", "openmlc-agent.js");
    const buf = await readFile(agentPath);
    return new NextResponse(buf, {
      headers: {
        "content-type": "application/javascript",
        "content-disposition": 'attachment; filename="openmlc-agent.js"',
        "content-length": String(buf.byteLength),
        "cache-control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Agent binary not found" }, { status: 404 });
  }
}

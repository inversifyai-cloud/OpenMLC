interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

export async function tavilySearch(query: string, apiKey?: string): Promise<string> {
  const key = apiKey ?? process.env.TAVILY_API_KEY;
  if (!key) throw new Error("Tavily API key not configured");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "advanced",
      max_results: 8,
      include_answer: true,
    }),
  });

  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);

  const data: TavilyResponse = await res.json();

  const parts: string[] = [];
  if (data.answer) {
    parts.push(`Summary: ${data.answer}`);
  }
  parts.push(
    ...data.results.map(
      (r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
    )
  );

  return parts.join("\n\n");
}

export function tavilyAvailable(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

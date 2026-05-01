export type HubModel = {
  id: string;
  name: string;
  description: string;
  paramSize: string;
  diskGb: number;
  contextWindow: number;
  tags: Array<"fast" | "code" | "vision" | "reasoning" | "large">;
  variants: Array<{ id: string; label: string; diskGb: number }>;
};

export const HUB_MODELS: HubModel[] = [
  {
    id: "llama3.2",
    name: "Llama 3.2",
    description: "Meta's latest small model. Fast, capable, great for everyday tasks.",
    paramSize: "3B",
    diskGb: 2.0,
    contextWindow: 131072,
    tags: ["fast"],
    variants: [
      { id: "llama3.2:1b", label: "1B · 1.3 GB", diskGb: 1.3 },
      { id: "llama3.2:3b", label: "3B · 2.0 GB", diskGb: 2.0 },
    ],
  },
  {
    id: "llama3.1",
    name: "Llama 3.1",
    description: "Solid all-rounder with a huge context window.",
    paramSize: "8B",
    diskGb: 4.7,
    contextWindow: 131072,
    tags: [],
    variants: [
      { id: "llama3.1:8b", label: "8B · 4.7 GB", diskGb: 4.7 },
      { id: "llama3.1:70b", label: "70B · 40 GB", diskGb: 40 },
    ],
  },
  {
    id: "llama3.3",
    name: "Llama 3.3",
    description: "Meta's large instruction-following model. Strong reasoning at scale.",
    paramSize: "70B",
    diskGb: 43,
    contextWindow: 131072,
    tags: ["large", "reasoning"],
    variants: [
      { id: "llama3.3:70b", label: "70B · 43 GB", diskGb: 43 },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Fast, dense 7B model. Punches above its weight for instruction following.",
    paramSize: "7B",
    diskGb: 4.1,
    contextWindow: 32768,
    tags: ["fast"],
    variants: [
      { id: "mistral:7b", label: "7B · 4.1 GB", diskGb: 4.1 },
    ],
  },
  {
    id: "mistral-nemo",
    name: "Mistral Nemo",
    description: "12B model from Mistral + NVIDIA. Strong multilingual and code support.",
    paramSize: "12B",
    diskGb: 7.1,
    contextWindow: 128000,
    tags: ["code"],
    variants: [
      { id: "mistral-nemo:12b", label: "12B · 7.1 GB", diskGb: 7.1 },
    ],
  },
  {
    id: "gemma3",
    name: "Gemma 3",
    description: "Google's open model family. Vision-capable on larger variants.",
    paramSize: "4B",
    diskGb: 3.3,
    contextWindow: 131072,
    tags: ["fast", "vision"],
    variants: [
      { id: "gemma3:1b", label: "1B · 0.8 GB", diskGb: 0.8 },
      { id: "gemma3:4b", label: "4B · 3.3 GB", diskGb: 3.3 },
      { id: "gemma3:12b", label: "12B · 8.1 GB", diskGb: 8.1 },
      { id: "gemma3:27b", label: "27B · 17 GB", diskGb: 17 },
    ],
  },
  {
    id: "phi4",
    name: "Phi-4",
    description: "Microsoft's reasoning-focused 14B model. Exceptional at math and science.",
    paramSize: "14B",
    diskGb: 9.1,
    contextWindow: 16384,
    tags: ["reasoning"],
    variants: [
      { id: "phi4:14b", label: "14B · 9.1 GB", diskGb: 9.1 },
    ],
  },
  {
    id: "phi4-mini",
    name: "Phi-4 Mini",
    description: "Compact reasoning model from Microsoft. Fast and surprisingly capable.",
    paramSize: "3.8B",
    diskGb: 2.5,
    contextWindow: 16384,
    tags: ["fast", "reasoning"],
    variants: [
      { id: "phi4-mini:3.8b", label: "3.8B · 2.5 GB", diskGb: 2.5 },
    ],
  },
  {
    id: "qwen2.5",
    name: "Qwen 2.5",
    description: "Alibaba's multilingual model. Excellent at Asian languages and coding.",
    paramSize: "7B",
    diskGb: 4.7,
    contextWindow: 131072,
    tags: [],
    variants: [
      { id: "qwen2.5:3b", label: "3B · 2.0 GB", diskGb: 2.0 },
      { id: "qwen2.5:7b", label: "7B · 4.7 GB", diskGb: 4.7 },
      { id: "qwen2.5:14b", label: "14B · 9.0 GB", diskGb: 9.0 },
      { id: "qwen2.5:32b", label: "32B · 20 GB", diskGb: 20 },
    ],
  },
  {
    id: "qwen2.5-coder",
    name: "Qwen 2.5 Coder",
    description: "Code-specialized variant of Qwen 2.5. Strong at generation, debugging, and completion.",
    paramSize: "7B",
    diskGb: 4.7,
    contextWindow: 131072,
    tags: ["code"],
    variants: [
      { id: "qwen2.5-coder:7b", label: "7B · 4.7 GB", diskGb: 4.7 },
      { id: "qwen2.5-coder:14b", label: "14B · 9.0 GB", diskGb: 9.0 },
      { id: "qwen2.5-coder:32b", label: "32B · 20 GB", diskGb: 20 },
    ],
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    description: "Chain-of-thought reasoning model. Thinks out loud before answering.",
    paramSize: "7B",
    diskGb: 4.7,
    contextWindow: 65536,
    tags: ["reasoning"],
    variants: [
      { id: "deepseek-r1:1.5b", label: "1.5B · 1.1 GB", diskGb: 1.1 },
      { id: "deepseek-r1:7b", label: "7B · 4.7 GB", diskGb: 4.7 },
      { id: "deepseek-r1:14b", label: "14B · 9.0 GB", diskGb: 9.0 },
      { id: "deepseek-r1:32b", label: "32B · 20 GB", diskGb: 20 },
    ],
  },
  {
    id: "deepseek-coder-v2",
    name: "DeepSeek Coder V2",
    description: "Dedicated coding model with strong completion and bug-finding.",
    paramSize: "16B",
    diskGb: 8.9,
    contextWindow: 163840,
    tags: ["code"],
    variants: [
      { id: "deepseek-coder-v2:16b", label: "16B · 8.9 GB", diskGb: 8.9 },
    ],
  },
  {
    id: "llava",
    name: "LLaVA",
    description: "Vision + language model. Point it at an image and ask questions.",
    paramSize: "7B",
    diskGb: 4.5,
    contextWindow: 4096,
    tags: ["vision"],
    variants: [
      { id: "llava:7b", label: "7B · 4.5 GB", diskGb: 4.5 },
      { id: "llava:13b", label: "13B · 8.0 GB", diskGb: 8.0 },
    ],
  },
  {
    id: "codellama",
    name: "Code Llama",
    description: "Meta's code-focused Llama derivative. Good at fill-in-the-middle and infill.",
    paramSize: "7B",
    diskGb: 3.8,
    contextWindow: 100000,
    tags: ["code"],
    variants: [
      { id: "codellama:7b", label: "7B · 3.8 GB", diskGb: 3.8 },
      { id: "codellama:13b", label: "13B · 7.4 GB", diskGb: 7.4 },
    ],
  },
  {
    id: "nomic-embed-text",
    name: "Nomic Embed Text",
    description: "High-quality text embedding model. Useful for RAG and semantic search.",
    paramSize: "137M",
    diskGb: 0.27,
    contextWindow: 8192,
    tags: ["fast"],
    variants: [
      { id: "nomic-embed-text", label: "137M · 0.27 GB", diskGb: 0.27 },
    ],
  },
];

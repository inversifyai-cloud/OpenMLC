export type HubModelSize = {
  id: string;      // e.g. "qwen3:14b"
  params: string;  // e.g. "14B"
  diskGb: number;  // approximate disk at default quant
  // Explicit quant suffixes available in the Ollama registry for this size.
  // When undefined, no quant picker is shown (only the default tag is pullable).
  quants?: string[];
};

export type QuantOption = {
  suffix: string;        // appended to size id, e.g. "-q8_0"
  label: string;
  note: string;
  sizeMultiplier: number; // relative to q4_K_M baseline (1.0)
};

export type HubModel = {
  id: string;
  name: string;
  description: string;
  paramSize: string;
  diskGb: number;
  contextWindow: number;
  tags: Array<"fast" | "code" | "vision" | "reasoning" | "large" | "embedding" | "multilingual" | "moe">;
  sizes: HubModelSize[];
};

// All known quant options with size multipliers relative to q4_K_M (1.0).
// Only quants listed in a size's `quants` array are shown in the picker.
export const QUANT_OPTIONS: QuantOption[] = [
  { suffix: "",         label: "default",   note: "recommended",    sizeMultiplier: 1.00 },
  { suffix: "-q2_K",   label: "q2_K",      note: "smallest",        sizeMultiplier: 0.61 },
  { suffix: "-q3_K_M", label: "q3_K_M",    note: "very small",      sizeMultiplier: 0.76 },
  { suffix: "-q4_K_S", label: "q4_K_S",    note: "slightly smaller", sizeMultiplier: 0.92 },
  { suffix: "-q4_K_M", label: "q4_K_M",    note: "default quality", sizeMultiplier: 1.00 },
  { suffix: "-q5_K_M", label: "q5_K_M",    note: "higher quality",  sizeMultiplier: 1.27 },
  { suffix: "-q6_K",   label: "q6_K",      note: "near lossless",   sizeMultiplier: 1.57 },
  { suffix: "-q8_0",   label: "q8_0",      note: "best quality",    sizeMultiplier: 1.64 },
  { suffix: "-fp16",   label: "fp16",      note: "full precision",  sizeMultiplier: 3.00 },
];

export const HUB_MODELS: HubModel[] = [
  // ── QWEN 3 ───────────────────────────────────────────────────────────────
  {
    id: "qwen3",
    name: "Qwen3",
    description: "Alibaba's latest flagship. Hybrid thinking mode with best-in-class benchmarks across sizes.",
    paramSize: "8B",
    diskGb: 5.2,
    contextWindow: 131072,
    tags: ["reasoning"],
    sizes: [
      { id: "qwen3:0.6b", params: "0.6B", diskGb: 0.4,  quants: ["-q4_K_M"] },
      { id: "qwen3:1.7b", params: "1.7B", diskGb: 1.1,  quants: ["-q4_K_M"] },
      { id: "qwen3:4b",   params: "4B",   diskGb: 2.6,  quants: ["-q4_K_M"] },
      { id: "qwen3:8b",   params: "8B",   diskGb: 5.2,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen3:14b",  params: "14B",  diskGb: 9.0,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen3:32b",  params: "32B",  diskGb: 20.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── QwQ ──────────────────────────────────────────────────────────────────
  {
    id: "qwq",
    name: "QwQ",
    description: "Qwen's dedicated slow-think reasoning model. Deep chain-of-thought before answering.",
    paramSize: "32B",
    diskGb: 20.0,
    contextWindow: 131072,
    tags: ["reasoning", "large"],
    sizes: [
      { id: "qwq:32b", params: "32B", diskGb: 20.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── QWEN 2.5 ─────────────────────────────────────────────────────────────
  {
    id: "qwen2.5",
    name: "Qwen 2.5",
    description: "Alibaba's multilingual powerhouse. Excellent at Asian languages, coding, and math.",
    paramSize: "7B",
    diskGb: 4.7,
    contextWindow: 131072,
    tags: ["multilingual"],
    sizes: [
      { id: "qwen2.5:0.5b", params: "0.5B", diskGb: 0.4,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5:1.5b", params: "1.5B", diskGb: 1.0,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5:3b",   params: "3B",   diskGb: 2.0,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5:7b",   params: "7B",   diskGb: 4.7,  quants: ["-q4_K_M", "-q5_K_M", "-q8_0"] },
      { id: "qwen2.5:14b",  params: "14B",  diskGb: 9.0,  quants: ["-q4_K_M", "-q5_K_M", "-q8_0"] },
      { id: "qwen2.5:32b",  params: "32B",  diskGb: 20.0, quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5:72b",  params: "72B",  diskGb: 47.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── QWEN 2.5 CODER ───────────────────────────────────────────────────────
  {
    id: "qwen2.5-coder",
    name: "Qwen 2.5 Coder",
    description: "Code-specialized Qwen 2.5. Strong at generation, debugging, and completion across 40+ languages.",
    paramSize: "7B",
    diskGb: 4.7,
    contextWindow: 131072,
    tags: ["code"],
    sizes: [
      { id: "qwen2.5-coder:1.5b", params: "1.5B", diskGb: 1.0,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5-coder:3b",   params: "3B",   diskGb: 2.0,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5-coder:7b",   params: "7B",   diskGb: 4.7,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5-coder:14b",  params: "14B",  diskGb: 9.0,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "qwen2.5-coder:32b",  params: "32B",  diskGb: 20.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── QWEN 2.5 VL ──────────────────────────────────────────────────────────
  {
    id: "qwen2.5-vl",
    name: "Qwen 2.5 VL",
    description: "Alibaba's vision-language model. Understands images, diagrams, screenshots, and documents.",
    paramSize: "7B",
    diskGb: 5.4,
    contextWindow: 32768,
    tags: ["vision"],
    sizes: [
      { id: "qwen2.5-vl:3b",  params: "3B",  diskGb: 2.3  },
      { id: "qwen2.5-vl:7b",  params: "7B",  diskGb: 5.4  },
      { id: "qwen2.5-vl:32b", params: "32B", diskGb: 20.0 },
      { id: "qwen2.5-vl:72b", params: "72B", diskGb: 47.0 },
    ],
  },

  // ── DEEPSEEK R1 ──────────────────────────────────────────────────────────
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    description: "Chain-of-thought reasoning model. Thinks step-by-step before answering. Open-source rival to o1.",
    paramSize: "7B",
    diskGb: 4.7,
    contextWindow: 65536,
    tags: ["reasoning"],
    sizes: [
      { id: "deepseek-r1:1.5b", params: "1.5B", diskGb: 1.1,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "deepseek-r1:7b",   params: "7B",   diskGb: 4.7,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "deepseek-r1:8b",   params: "8B",   diskGb: 5.2,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "deepseek-r1:14b",  params: "14B",  diskGb: 9.0,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "deepseek-r1:32b",  params: "32B",  diskGb: 20.0, quants: ["-q4_K_M", "-q8_0"] },
      { id: "deepseek-r1:70b",  params: "70B",  diskGb: 43.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── DEEPSEEK CODER V2 ────────────────────────────────────────────────────
  {
    id: "deepseek-coder-v2",
    name: "DeepSeek Coder V2",
    description: "MoE coding model — activates 2.4B of 16B params per token. Strong code generation and debugging.",
    paramSize: "16B",
    diskGb: 8.9,
    contextWindow: 163840,
    tags: ["code", "moe"],
    sizes: [
      { id: "deepseek-coder-v2:16b",  params: "16B",  diskGb: 8.9,   quants: ["-q4_K_M", "-q8_0"] },
      { id: "deepseek-coder-v2:236b", params: "236B", diskGb: 133.0 },
    ],
  },

  // ── LLAMA 3.2 ────────────────────────────────────────────────────────────
  {
    id: "llama3.2",
    name: "Llama 3.2",
    description: "Meta's latest small model. Fast, capable, great for everyday tasks with a 128K context window.",
    paramSize: "3B",
    diskGb: 2.0,
    contextWindow: 131072,
    tags: ["fast"],
    sizes: [
      { id: "llama3.2:1b", params: "1B", diskGb: 1.3, quants: ["-q4_K_M", "-q8_0", "-fp16"] },
      { id: "llama3.2:3b", params: "3B", diskGb: 2.0, quants: ["-q4_K_M", "-q8_0", "-fp16"] },
    ],
  },

  // ── LLAMA 3.2 VISION ─────────────────────────────────────────────────────
  {
    id: "llama3.2-vision",
    name: "Llama 3.2 Vision",
    description: "Meta's multimodal Llama. Analyze images, charts, and photos with natural language questions.",
    paramSize: "11B",
    diskGb: 7.9,
    contextWindow: 131072,
    tags: ["vision"],
    sizes: [
      { id: "llama3.2-vision:11b", params: "11B", diskGb: 7.9  },
      { id: "llama3.2-vision:90b", params: "90B", diskGb: 55.0 },
    ],
  },

  // ── LLAMA 3.1 ────────────────────────────────────────────────────────────
  {
    id: "llama3.1",
    name: "Llama 3.1",
    description: "Solid all-rounder from Meta with a huge 128K context window.",
    paramSize: "8B",
    diskGb: 4.7,
    contextWindow: 131072,
    tags: [],
    sizes: [
      {
        id: "llama3.1:8b", params: "8B", diskGb: 4.7,
        quants: ["-q3_K_M", "-q4_K_S", "-q4_K_M", "-q5_K_M", "-q6_K", "-q8_0", "-fp16"],
      },
      {
        id: "llama3.1:70b", params: "70B", diskGb: 40.0,
        quants: ["-q2_K", "-q3_K_M", "-q4_K_M", "-q5_K_M", "-q8_0"],
      },
    ],
  },

  // ── LLAMA 3.3 ────────────────────────────────────────────────────────────
  {
    id: "llama3.3",
    name: "Llama 3.3",
    description: "Meta's large instruction-following model. Strong reasoning at scale — comparable to Llama 3.1 405B.",
    paramSize: "70B",
    diskGb: 43.0,
    contextWindow: 131072,
    tags: ["large", "reasoning"],
    sizes: [
      {
        id: "llama3.3:70b", params: "70B", diskGb: 43.0,
        quants: ["-q2_K", "-q3_K_M", "-q4_K_M", "-q5_K_M", "-q8_0"],
      },
    ],
  },

  // ── MISTRAL ──────────────────────────────────────────────────────────────
  {
    id: "mistral",
    name: "Mistral",
    description: "Fast, dense 7B model. Punches above its weight for instruction following and general tasks.",
    paramSize: "7B",
    diskGb: 4.1,
    contextWindow: 32768,
    tags: ["fast"],
    sizes: [
      {
        id: "mistral:7b", params: "7B", diskGb: 4.1,
        quants: ["-q4_K_M", "-q5_K_M", "-q6_K", "-q8_0"],
      },
    ],
  },

  // ── MISTRAL SMALL ────────────────────────────────────────────────────────
  {
    id: "mistral-small",
    name: "Mistral Small",
    description: "Mistral's 24B model — a significant step up from 7B without Mixtral's footprint.",
    paramSize: "24B",
    diskGb: 15.0,
    contextWindow: 32768,
    tags: [],
    sizes: [
      { id: "mistral-small:24b", params: "24B", diskGb: 15.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── MISTRAL NEMO ─────────────────────────────────────────────────────────
  {
    id: "mistral-nemo",
    name: "Mistral Nemo",
    description: "12B model from Mistral + NVIDIA. Strong multilingual support and coding across 128K context.",
    paramSize: "12B",
    diskGb: 7.1,
    contextWindow: 128000,
    tags: ["code", "multilingual"],
    sizes: [
      { id: "mistral-nemo:12b", params: "12B", diskGb: 7.1, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── MIXTRAL ──────────────────────────────────────────────────────────────
  {
    id: "mixtral",
    name: "Mixtral",
    description: "Mistral's mixture-of-experts model. Activates 2 of 8 experts per token — fast with large-model quality.",
    paramSize: "8x7B",
    diskGb: 26.0,
    contextWindow: 47000,
    tags: ["moe", "large"],
    sizes: [
      { id: "mixtral:8x7b",  params: "8×7B",  diskGb: 26.0, quants: ["-q4_K_M", "-q5_K_M", "-q8_0"] },
      { id: "mixtral:8x22b", params: "8×22B", diskGb: 80.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── GEMMA 3 ──────────────────────────────────────────────────────────────
  {
    id: "gemma3",
    name: "Gemma 3",
    description: "Google's open model family. Vision-capable on 4B+ variants. Strong on benchmarks across all sizes.",
    paramSize: "4B",
    diskGb: 3.3,
    contextWindow: 131072,
    tags: ["fast", "vision"],
    sizes: [
      { id: "gemma3:1b",  params: "1B",  diskGb: 0.8  },
      { id: "gemma3:4b",  params: "4B",  diskGb: 3.3,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "gemma3:12b", params: "12B", diskGb: 8.1,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "gemma3:27b", params: "27B", diskGb: 17.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── PHI-4 ────────────────────────────────────────────────────────────────
  {
    id: "phi4",
    name: "Phi-4",
    description: "Microsoft's reasoning-focused 14B model. Exceptional at math, science, and structured output.",
    paramSize: "14B",
    diskGb: 9.1,
    contextWindow: 16384,
    tags: ["reasoning"],
    sizes: [
      { id: "phi4:14b", params: "14B", diskGb: 9.1, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── PHI-4 MINI ───────────────────────────────────────────────────────────
  {
    id: "phi4-mini",
    name: "Phi-4 Mini",
    description: "Compact reasoning model from Microsoft. Fast and surprisingly capable for its 3.8B size.",
    paramSize: "3.8B",
    diskGb: 2.5,
    contextWindow: 16384,
    tags: ["fast", "reasoning"],
    sizes: [
      { id: "phi4-mini:3.8b", params: "3.8B", diskGb: 2.5, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── COMMAND R ────────────────────────────────────────────────────────────
  {
    id: "command-r",
    name: "Command R",
    description: "Cohere's RAG-optimized model. Built for retrieval-augmented generation, tool use, and long documents.",
    paramSize: "35B",
    diskGb: 21.0,
    contextWindow: 131072,
    tags: ["large"],
    sizes: [
      { id: "command-r:35b", params: "35B", diskGb: 21.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── COMMAND R+ ───────────────────────────────────────────────────────────
  {
    id: "command-r-plus",
    name: "Command R+",
    description: "Cohere's flagship 104B model. Enterprise-grade instruction following and RAG at scale.",
    paramSize: "104B",
    diskGb: 62.0,
    contextWindow: 131072,
    tags: ["large"],
    sizes: [
      { id: "command-r-plus:104b", params: "104B", diskGb: 62.0, quants: ["-q4_K_M"] },
    ],
  },

  // ── FALCON 3 ─────────────────────────────────────────────────────────────
  {
    id: "falcon3",
    name: "Falcon 3",
    description: "TII's third-gen open model. Strong across sizes from 1B to 10B.",
    paramSize: "7B",
    diskGb: 4.5,
    contextWindow: 32768,
    tags: [],
    sizes: [
      { id: "falcon3:1b",  params: "1B",  diskGb: 0.7 },
      { id: "falcon3:3b",  params: "3B",  diskGb: 2.0, quants: ["-q4_K_M", "-q8_0"] },
      { id: "falcon3:7b",  params: "7B",  diskGb: 4.5, quants: ["-q4_K_M", "-q8_0"] },
      { id: "falcon3:10b", params: "10B", diskGb: 6.4, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── STARCODER 2 ──────────────────────────────────────────────────────────
  {
    id: "starcoder2",
    name: "StarCoder 2",
    description: "Hugging Face's code model trained on 600+ languages from The Stack v2. Strong at completion and infill.",
    paramSize: "7B",
    diskGb: 4.0,
    contextWindow: 16384,
    tags: ["code"],
    sizes: [
      { id: "starcoder2:3b",  params: "3B",  diskGb: 1.7, quants: ["-q4_K_M", "-q8_0"] },
      { id: "starcoder2:7b",  params: "7B",  diskGb: 4.0, quants: ["-q4_K_M", "-q8_0"] },
      { id: "starcoder2:15b", params: "15B", diskGb: 9.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── YI CODER ─────────────────────────────────────────────────────────────
  {
    id: "yi-coder",
    name: "Yi Coder",
    description: "01.AI's coding model with a 128K context window. Strong at code generation, explanation, and refactoring.",
    paramSize: "9B",
    diskGb: 5.5,
    contextWindow: 131072,
    tags: ["code"],
    sizes: [
      { id: "yi-coder:9b", params: "9B", diskGb: 5.5, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── AYA EXPANSE ──────────────────────────────────────────────────────────
  {
    id: "aya-expanse",
    name: "Aya Expanse",
    description: "Cohere's multilingual model covering 23 languages. Best-in-class non-English performance for its size.",
    paramSize: "8B",
    diskGb: 4.9,
    contextWindow: 8192,
    tags: ["multilingual"],
    sizes: [
      { id: "aya-expanse:8b",  params: "8B",  diskGb: 4.9,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "aya-expanse:32b", params: "32B", diskGb: 20.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── OLMO 2 ───────────────────────────────────────────────────────────────
  {
    id: "olmo2",
    name: "OLMo 2",
    description: "Allen Institute's fully open model — open weights, training data, and code. Solid instruction following.",
    paramSize: "7B",
    diskGb: 4.5,
    contextWindow: 4096,
    tags: [],
    sizes: [
      { id: "olmo2:7b",  params: "7B",  diskGb: 4.5, quants: ["-q4_K_M", "-q8_0"] },
      { id: "olmo2:13b", params: "13B", diskGb: 8.2, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── GRANITE 3.3 ──────────────────────────────────────────────────────────
  {
    id: "granite3.3",
    name: "Granite 3.3",
    description: "IBM's enterprise-focused model. Optimized for business tasks, tool use, and agentic workflows.",
    paramSize: "8B",
    diskGb: 5.2,
    contextWindow: 131072,
    tags: [],
    sizes: [
      { id: "granite3.3:2b", params: "2B", diskGb: 1.7, quants: ["-q4_K_M", "-q8_0"] },
      { id: "granite3.3:8b", params: "8B", diskGb: 5.2, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── SMOLLM 2 ─────────────────────────────────────────────────────────────
  {
    id: "smollm2",
    name: "SmolLM2",
    description: "Hugging Face's tiny models that punch above their weight. Ideal for edge devices and fast inference.",
    paramSize: "1.7B",
    diskGb: 1.1,
    contextWindow: 8192,
    tags: ["fast"],
    sizes: [
      { id: "smollm2:135m", params: "135M", diskGb: 0.3 },
      { id: "smollm2:360m", params: "360M", diskGb: 0.7 },
      { id: "smollm2:1.7b", params: "1.7B", diskGb: 1.1, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── LLAVA ────────────────────────────────────────────────────────────────
  {
    id: "llava",
    name: "LLaVA",
    description: "Vision + language model. Point it at an image and ask questions in natural language.",
    paramSize: "7B",
    diskGb: 4.5,
    contextWindow: 4096,
    tags: ["vision"],
    sizes: [
      { id: "llava:7b",  params: "7B",  diskGb: 4.5  },
      { id: "llava:13b", params: "13B", diskGb: 8.0  },
      { id: "llava:34b", params: "34B", diskGb: 20.0 },
    ],
  },

  // ── CODE LLAMA ───────────────────────────────────────────────────────────
  {
    id: "codellama",
    name: "Code Llama",
    description: "Meta's code-focused Llama derivative. Good at fill-in-the-middle and infill across many languages.",
    paramSize: "7B",
    diskGb: 3.8,
    contextWindow: 100000,
    tags: ["code"],
    sizes: [
      { id: "codellama:7b",  params: "7B",  diskGb: 3.8,  quants: ["-q4_K_M", "-q5_K_M", "-q8_0"] },
      { id: "codellama:13b", params: "13B", diskGb: 7.4,  quants: ["-q4_K_M", "-q8_0"] },
      { id: "codellama:34b", params: "34B", diskGb: 19.0, quants: ["-q4_K_M", "-q8_0"] },
    ],
  },

  // ── NOMIC EMBED TEXT ─────────────────────────────────────────────────────
  {
    id: "nomic-embed-text",
    name: "Nomic Embed Text",
    description: "High-quality text embedding model. Use for RAG pipelines, semantic search, and similarity matching.",
    paramSize: "137M",
    diskGb: 0.27,
    contextWindow: 8192,
    tags: ["embedding", "fast"],
    sizes: [
      { id: "nomic-embed-text", params: "137M", diskGb: 0.27 },
    ],
  },

  // ── MXBAI EMBED LARGE ────────────────────────────────────────────────────
  {
    id: "mxbai-embed-large",
    name: "mxbai-embed-large",
    description: "MixedBread's high-accuracy embedding model. Tops MTEB benchmarks for semantic retrieval tasks.",
    paramSize: "335M",
    diskGb: 0.67,
    contextWindow: 512,
    tags: ["embedding"],
    sizes: [
      { id: "mxbai-embed-large", params: "335M", diskGb: 0.67 },
    ],
  },

  // ── BGE-M3 ───────────────────────────────────────────────────────────────
  {
    id: "bge-m3",
    name: "BGE-M3",
    description: "BAAI's multilingual embedding model. Supports 100+ languages with dense, sparse, and multi-vector retrieval.",
    paramSize: "570M",
    diskGb: 1.2,
    contextWindow: 8192,
    tags: ["embedding", "multilingual"],
    sizes: [
      { id: "bge-m3", params: "570M", diskGb: 1.2 },
    ],
  },
];

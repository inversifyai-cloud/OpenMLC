

export interface ModelPricing {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {

  "gpt-4o":            { inputUsdPerMTok: 2.5,   outputUsdPerMTok: 10.0  },
  "gpt-4o-mini":       { inputUsdPerMTok: 0.15,  outputUsdPerMTok: 0.6   },
  "gpt-5.4":           { inputUsdPerMTok: 15.0,  outputUsdPerMTok: 60.0  },
  "gpt-5.4-mini":      { inputUsdPerMTok: 1.1,   outputUsdPerMTok: 4.4   },
  "gpt-5.4-nano":      { inputUsdPerMTok: 0.1,   outputUsdPerMTok: 0.4   },
  "gpt-5.2":           { inputUsdPerMTok: 5.0,   outputUsdPerMTok: 20.0  },
  "gpt-4.1":           { inputUsdPerMTok: 2.0,   outputUsdPerMTok: 8.0   },
  "gpt-4.1-mini":      { inputUsdPerMTok: 0.4,   outputUsdPerMTok: 1.6   },
  "gpt-4.1-nano":      { inputUsdPerMTok: 0.1,   outputUsdPerMTok: 0.4   },

  "o4-mini":           { inputUsdPerMTok: 1.1,   outputUsdPerMTok: 4.4   },
  "o3":                { inputUsdPerMTok: 10.0,  outputUsdPerMTok: 40.0  },
  "o3-mini":           { inputUsdPerMTok: 1.1,   outputUsdPerMTok: 4.4   },

  "claude-opus-4-6":          { inputUsdPerMTok: 15.0, outputUsdPerMTok: 75.0  },
  "claude-sonnet-4-6":        { inputUsdPerMTok: 3.0,  outputUsdPerMTok: 15.0  },
  "claude-haiku-4-5-20251001":{ inputUsdPerMTok: 0.8,  outputUsdPerMTok: 4.0   },
  "claude-opus-4-5":          { inputUsdPerMTok: 15.0, outputUsdPerMTok: 75.0  },
  "claude-sonnet-4-5":        { inputUsdPerMTok: 3.0,  outputUsdPerMTok: 15.0  },
  "claude-opus-4-20250514":   { inputUsdPerMTok: 15.0, outputUsdPerMTok: 75.0  },
  "claude-sonnet-4-20250514": { inputUsdPerMTok: 3.0,  outputUsdPerMTok: 15.0  },

  "gemini-2.5-pro":        { inputUsdPerMTok: 1.25, outputUsdPerMTok: 10.0  },
  "gemini-2.5-flash":      { inputUsdPerMTok: 0.15, outputUsdPerMTok: 0.6   },
  "gemini-2.5-flash-lite": { inputUsdPerMTok: 0.07, outputUsdPerMTok: 0.3   },
  "gemini-2.0-flash":      { inputUsdPerMTok: 0.1,  outputUsdPerMTok: 0.4   },
  "gemini-2.0-flash-lite": { inputUsdPerMTok: 0.07, outputUsdPerMTok: 0.3   },

  "grok-3":          { inputUsdPerMTok: 3.0,  outputUsdPerMTok: 15.0  },
  "grok-3-fast":     { inputUsdPerMTok: 5.0,  outputUsdPerMTok: 25.0  },
  "grok-3-mini":     { inputUsdPerMTok: 0.3,  outputUsdPerMTok: 0.5   },
  "grok-3-mini-fast":{ inputUsdPerMTok: 0.6,  outputUsdPerMTok: 4.0   },

  "accounts/fireworks/models/gpt-oss-120b":        { inputUsdPerMTok: 0.9,  outputUsdPerMTok: 0.9  },
  "accounts/fireworks/models/llama-v3p3-70b-instruct":{ inputUsdPerMTok: 0.9, outputUsdPerMTok: 0.9 },
  "accounts/fireworks/models/deepseek-v3p1":       { inputUsdPerMTok: 0.9,  outputUsdPerMTok: 0.9  },
  "accounts/fireworks/models/deepseek-v3p2":       { inputUsdPerMTok: 0.9,  outputUsdPerMTok: 0.9  },

};

export function getPriceForModel(
  _providerId: string,
  providerModelId: string
): ModelPricing | null {
  return PRICING_TABLE[providerModelId] ?? null;
}

export function computeCostUsd(
  pricing: ModelPricing | null,
  inputTokens: number,
  outputTokens: number
): number {
  if (!pricing) return 0;
  return (
    (inputTokens * pricing.inputUsdPerMTok) / 1_000_000 +
    (outputTokens * pricing.outputUsdPerMTok) / 1_000_000
  );
}

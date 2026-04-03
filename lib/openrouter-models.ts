export const DEFAULT_OPENROUTER_ANALYZE_MODEL =
  'google/gemini-3-flash-preview'
export const DEFAULT_OPENROUTER_SUMMARIZE_MODEL =
  'google/gemini-3.1-pro-preview'
export const DEFAULT_OPENROUTER_REFINE_MODEL = 'anthropic/claude-haiku-4.5'

export interface OpenRouterModelConfig {
  analyzeModel: string
  summarizeModel: string
  refineModel: string
}

export function resolveOpenRouterModelConfig(config?: {
  analyzeModel?: string | null
  summarizeModel?: string | null
  refineModel?: string | null
}): OpenRouterModelConfig {
  return {
    analyzeModel:
      config?.analyzeModel?.trim() || DEFAULT_OPENROUTER_ANALYZE_MODEL,
    summarizeModel:
      config?.summarizeModel?.trim() || DEFAULT_OPENROUTER_SUMMARIZE_MODEL,
    refineModel: config?.refineModel?.trim() || DEFAULT_OPENROUTER_REFINE_MODEL,
  }
}

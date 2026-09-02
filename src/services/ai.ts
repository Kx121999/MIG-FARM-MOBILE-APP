import { AIProductResult, ChatImage, Language, SelectedProductContext } from '@/types';

const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const AI_API_URL = env.EXPO_PUBLIC_AI_API_URL || 'https://mig-farm-ai-backend.vercel.app/api/chat';

export type AIRequest = {
  message: string;
  session_id: string;
  locale: Language;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversation_state?: Record<string, unknown>;
  images?: ChatImage[];
  selected_product_context?: SelectedProductContext | null;
};

export type AIResponse = {
  reply?: string;
  display_reply?: string;
  results?: AIProductResult[];
  quick_replies?: string[];
  conversation_state?: Record<string, unknown>;
};

function normalizeResponse(value: unknown): AIResponse {
  if (!value || typeof value !== 'object') return {};

  const data = value as AIResponse & {
    products?: AIProductResult[];
    product_results?: AIProductResult[];
    state?: Record<string, unknown>;
  };

  return {
    reply: data.reply,
    display_reply: data.display_reply,
    results: data.results || data.products || data.product_results || [],
    quick_replies: Array.isArray(data.quick_replies) ? data.quick_replies : [],
    conversation_state: data.conversation_state || data.state,
  };
}

export async function sendAIMessage(payload: AIRequest, signal?: AbortSignal) {
  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`ai_request_failed_${response.status}`);
  }

  return normalizeResponse(await response.json());
}

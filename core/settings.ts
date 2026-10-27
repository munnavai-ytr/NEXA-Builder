// BYOK Settings and LocalStorage Management

export type AIProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter' | 'custom';

export interface ProviderMeta {
  id: AIProviderId;
  name: string;
  defaultModel: string;
  models: string[];
  placeholderKey: string;
  keyUrl?: string;
  defaultBaseUrl?: string;
}

export const PROVIDERS: Record<AIProviderId, ProviderMeta> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholderKey: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholderKey: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'gpt-4-turbo'],
    placeholderKey: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultModel: 'google/gemini-2.5-flash',
    models: [
      'google/gemini-2.5-flash',
      'anthropic/claude-3.5-sonnet',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'openai/gpt-4o',
    ],
    placeholderKey: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    defaultModel: 'llama-3.3-70b',
    models: ['llama-3.3-70b', 'mistral-large', 'qwen-2.5-72b', 'local-model'],
    placeholderKey: 'sk-... or custom token',
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
};

export interface NexaSettings {
  provider: AIProviderId;
  apiKeys: Record<AIProviderId, string>;
  models: Record<AIProviderId, string>;
  customBaseUrl: string;
  remoteRunnerUrl: string;
  remoteRunnerToken: string;
  theme: string;
  autoSave: boolean;
  autoRunPreview: boolean;
  enhancePrompts: boolean;
}

const SETTINGS_KEY = 'nexa_builder_settings_v1';

export const DEFAULT_SETTINGS: NexaSettings = {
  provider: 'gemini',
  apiKeys: {
    gemini: '',
    anthropic: '',
    openai: '',
    openrouter: '',
    custom: '',
  },
  models: {
    gemini: 'gemini-2.5-flash',
    anthropic: 'claude-3-5-sonnet-20241022',
    openai: 'gpt-4o',
    openrouter: 'google/gemini-2.5-flash',
    custom: 'llama-3.3-70b',
  },
  customBaseUrl: 'http://localhost:11434/v1',
  remoteRunnerUrl: '',
  remoteRunnerToken: '',
  theme: 'violetCyan',
  autoSave: true,
  autoRunPreview: true,
  enhancePrompts: true,
};

export function loadSettings(): NexaSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed.apiKeys },
      models: { ...DEFAULT_SETTINGS.models, ...parsed.models },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: NexaSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save NEXA settings to localStorage', err);
  }
}

export function hasActiveApiKey(settings: NexaSettings): boolean {
  const currentKey = settings.apiKeys[settings.provider];
  return Boolean(currentKey && currentKey.trim().length > 3);
}

// AI Provider Interface & Universal Streaming Client for Browser BYOK
import { AIProviderId, NexaSettings, PROVIDERS } from '../core/settings';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onChunk?: (delta: string) => void;
  signal?: AbortSignal;
}

export interface AIProvider {
  id: AIProviderId;
  name: string;
  streamChat(
    messages: ChatMessage[],
    settings: NexaSettings,
    options?: StreamOptions
  ): AsyncIterable<string>;
  testConnection(
    settings: NexaSettings
  ): Promise<{ success: boolean; message: string; latencyMs?: number }>;
}

/**
 * Google Gemini Provider Implementation (Browser Direct Fetch via SSE)
 */
export class GeminiProvider implements AIProvider {
  id: AIProviderId = 'gemini';
  name = 'Google Gemini';

  async *streamChat(
    messages: ChatMessage[],
    settings: NexaSettings,
    options?: StreamOptions
  ): AsyncIterable<string> {
    const apiKey = settings.apiKeys.gemini?.trim();
    if (!apiKey) {
      throw new Error('Google Gemini API Key is missing. Please enter your key in Settings.');
    }

    const model = options?.model || settings.models.gemini || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    // Convert messages to Gemini contents format
    const contents: any[] = [];
    let systemInstruction = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const body: any = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 8192,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = response.statusText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch {
        msg = errText || response.statusText;
      }
      throw new Error(`Gemini API Error (${response.status}): ${msg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream from Gemini API');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textChunk) {
            options?.onChunk?.(textChunk);
            yield textChunk;
          }
        } catch {
          // ignore stream parse glitches
        }
      }
    }
  }

  async testConnection(settings: NexaSettings): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const t0 = performance.now();
    try {
      const iter = this.streamChat(
        [{ role: 'user', content: 'Respond with the single word: "READY"' }],
        settings,
        { maxTokens: 10 }
      );
      let output = '';
      for await (const chunk of iter) {
        output += chunk;
        if (output.length > 5) break;
      }
      const latencyMs = Math.round(performance.now() - t0);
      return { success: true, message: `Connected to Gemini (${latencyMs}ms)`, latencyMs };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to connect to Gemini API' };
    }
  }
}

/**
 * Anthropic Claude Provider Implementation (Browser Direct Fetch via SSE)
 */
export class AnthropicProvider implements AIProvider {
  id: AIProviderId = 'anthropic';
  name = 'Anthropic Claude';

  async *streamChat(
    messages: ChatMessage[],
    settings: NexaSettings,
    options?: StreamOptions
  ): AsyncIterable<string> {
    const apiKey = settings.apiKeys.anthropic?.trim();
    if (!apiKey) {
      throw new Error('Anthropic Claude API Key is missing. Please enter your key in Settings.');
    }

    const model = options?.model || settings.models.anthropic || 'claude-3-5-sonnet-20241022';
    const endpoint = 'https://api.anthropic.com/v1/messages';

    let systemText = '';
    const anthropicMsgs: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemText += (systemText ? '\n\n' : '') + msg.content;
      } else {
        anthropicMsgs.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        messages: anthropicMsgs,
        system: systemText || undefined,
        stream: true,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = errText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch {}
      throw new Error(`Anthropic API Error (${response.status}): ${msg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from Anthropic');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, '');
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const chunk = parsed.delta.text;
            options?.onChunk?.(chunk);
            yield chunk;
          }
        } catch {}
      }
    }
  }

  async testConnection(settings: NexaSettings): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const t0 = performance.now();
    try {
      const iter = this.streamChat(
        [{ role: 'user', content: 'Say OK' }],
        settings,
        { maxTokens: 10 }
      );
      let output = '';
      for await (const chunk of iter) {
        output += chunk;
        if (output.length > 5) break;
      }
      const latencyMs = Math.round(performance.now() - t0);
      return { success: true, message: `Connected to Claude (${latencyMs}ms)`, latencyMs };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to connect to Anthropic' };
    }
  }
}

/**
 * Universal OpenAI-compatible streaming client (OpenAI, OpenRouter, Custom base URL)
 */
export class OpenAICompatibleProvider implements AIProvider {
  id: AIProviderId;
  name: string;
  defaultBaseUrl: string;

  constructor(id: AIProviderId, name: string, defaultBaseUrl: string) {
    this.id = id;
    this.name = name;
    this.defaultBaseUrl = defaultBaseUrl;
  }

  getBaseUrl(settings: NexaSettings): string {
    if (this.id === 'custom') {
      return (settings.customBaseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
    }
    if (this.id === 'openrouter') {
      return 'https://openrouter.ai/api/v1';
    }
    return 'https://api.openai.com/v1';
  }

  async *streamChat(
    messages: ChatMessage[],
    settings: NexaSettings,
    options?: StreamOptions
  ): AsyncIterable<string> {
    const apiKey = settings.apiKeys[this.id]?.trim();
    if (!apiKey && this.id !== 'custom') {
      throw new Error(`${this.name} API Key is missing. Please set your key in Settings.`);
    }

    const model = options?.model || settings.models[this.id] || PROVIDERS[this.id].defaultModel;
    const baseUrl = this.getBaseUrl(settings);
    const endpoint = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (this.id === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://nexa.studio';
      headers['X-Title'] = 'NEXA Builder';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = errText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch {}
      throw new Error(`${this.name} Error (${response.status}): ${msg}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No stream body received');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') break;

        try {
          const parsed = JSON.parse(payload);
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            options?.onChunk?.(chunk);
            yield chunk;
          }
        } catch {}
      }
    }
  }

  async testConnection(settings: NexaSettings): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const t0 = performance.now();
    try {
      const iter = this.streamChat(
        [{ role: 'user', content: 'Ping. Reply OK' }],
        settings,
        { maxTokens: 10 }
      );
      let output = '';
      for await (const chunk of iter) {
        output += chunk;
        if (output.length > 3) break;
      }
      const latencyMs = Math.round(performance.now() - t0);
      return { success: true, message: `Connected to ${this.name} (${latencyMs}ms)`, latencyMs };
    } catch (err: any) {
      return { success: false, message: err?.message || `Failed to connect to ${this.name}` };
    }
  }
}

// Instantiate providers
export const PROVIDER_INSTANCES: Record<AIProviderId, AIProvider> = {
  gemini: new GeminiProvider(),
  anthropic: new AnthropicProvider(),
  openai: new OpenAICompatibleProvider('openai', 'OpenAI', 'https://api.openai.com/v1'),
  openrouter: new OpenAICompatibleProvider('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1'),
  custom: new OpenAICompatibleProvider('custom', 'Custom OpenAI-Compatible', 'http://localhost:11434/v1'),
};

/**
 * System prompt generator for NEXA AI Builder
 */
export function buildSystemPrompt(projectFiles: { path: string; content: string }[]): string {
  const fileManifest = projectFiles
    .map((f) => `--- FILE: ${f.path} ---\n${f.content.slice(0, 3000)}${f.content.length > 3000 ? '\n...[truncated]' : ''}`)
    .join('\n\n');

  return `You are NEXA AI, an elite full-stack engineer and UI designer building full-stack web applications entirely in the browser.
The user describes app ideas, features, or bug fixes. You respond with clear explanations and structured file changes.

CRITICAL CODE MODIFICATION FORMAT:
Whenever creating or updating files, use explicit markdown code blocks tagged with the filename:

\`\`\`file:index.html
<!DOCTYPE html>
<html>
...
</html>
\`\`\`

\`\`\`file:style.css
...
\`\`\`

\`\`\`file:app.js
...
\`\`\`

Guidelines:
1. Always write complete, working code. Never leave TODOs, stubs, or placeholders.
2. Build mobile-first, responsive, and visually stunning dark interfaces with smooth interactions.
3. Keep code modular, clean, and self-contained.
4. If deleting a file, use:
\`\`\`delete:path/to/file.ext
\`\`\`

CURRENT PROJECT FILES:
${fileManifest || '(Project has no files yet)'}`;
}

/**
 * Helper to extract file modifications from assistant stream/markdown
 */
export function parseFileChangesFromText(text: string): { path: string; content: string; action: 'write' | 'delete' }[] {
  const results: { path: string; content: string; action: 'write' | 'delete' }[] = [];

  // Match ```file:path/to/file\n[content]\n```
  const fileRegex = /```file:([^\n\r]+)[\r\n]+([\s\S]*?)```/g;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    const path = match[1].trim();
    const content = match[2];
    if (path) {
      results.push({ path, content, action: 'write' });
    }
  }

  // Match ```delete:path/to/file\n```
  const deleteRegex = /```delete:([^\n\r]+)[\r\n]*```/g;
  while ((match = deleteRegex.exec(text)) !== null) {
    const path = match[1].trim();
    if (path) {
      results.push({ path, content: '', action: 'delete' });
    }
  }

  return results;
}

/**
 * Prompt Enhancer (Rewrites weak ideas into detailed specifications)
 */
export function enhanceUserPrompt(rawIdea: string): string {
  const trimmed = rawIdea.trim();
  if (!trimmed) {
    return 'Build a high-performance modern web application with real-time reactive state, dark glassmorphism design system, responsive mobile-first layout, and comprehensive interactive workflows.';
  }

  return `Build a production-grade web application for: "${trimmed}".

Key Architecture & Specifications:
1. DESIGN & AESTHETICS:
   - Deep obsidian theme (#070A12) with subtle 1px glass borders and radiant violet-to-cyan accents.
   - Smooth micro-interactions, responsive 44px touch targets, clean typographic scale with tabular numerals.
2. CORE FEATURES & LOGIC:
   - High-fidelity interactive UI with real state handling and instant client-side feedback.
   - Zero placeholder stubs: all buttons, filters, searches, and controls must have functional event listeners.
   - Persistent browser data management and reactive visual state transitions.
3. RESPONSIVE LAYOUT:
   - Fluid experience across mobile (<768px), tablet, and desktop viewports.
   - Clean structure with modular HTML, CSS variables, and modern ES JavaScript.`;
}

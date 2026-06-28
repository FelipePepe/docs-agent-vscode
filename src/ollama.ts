import { workspace } from 'vscode';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaConfig {
  url: string;
  model: string;
}

export function getOllamaConfig(): OllamaConfig {
  const cfg = workspace.getConfiguration('docsAgent');
  return {
    url: cfg.get<string>('ollamaUrl', 'http://localhost:11434'),
    model: cfg.get<string>('model', 'qwen3:35b'),
  };
}

export interface OllamaResult {
  content:          string;
  promptTokens:     number;
  completionTokens: number;
}

export async function chat(messages: OllamaMessage[], config: OllamaConfig): Promise<OllamaResult> {
  let response: Response;

  try {
    response = await fetch(`${config.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, stream: true }),
    });
  } catch (err) {
    throw new Error(
      `Cannot reach Ollama at ${config.url}. Is it running? (${(err as Error).message})`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404 && body.includes('model')) {
      throw new Error(
        `Model "${config.model}" not found in Ollama. Run: ollama pull ${config.model}`
      );
    }
    throw new Error(`Ollama returned HTTP ${response.status}: ${body}`);
  }

  const chunks: string[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let promptTokens     = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          chunks.push(parsed.message.content);
        }
        // Final chunk (done: true) carries token counts.
        if (parsed.done === true) {
          promptTokens     = parsed.prompt_eval_count ?? 0;
          completionTokens = parsed.eval_count        ?? 0;
        }
      } catch {
        // incomplete JSON chunk — skip
      }
    }
  }

  return { content: chunks.join(''), promptTokens, completionTokens };
}

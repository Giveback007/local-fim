import * as vscode from "vscode";

const FIM_STOP = ["<|fim_pad|>", "<|endoftext|>", "<|repo_name|>", "<|file_sep|>", "<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>"];
const TOKEN_TAG = /<\|[a-zA-Z0-9_]+\|>/g;

export interface FimProgress {
  onToken?: (accumulated: string, tokenCount: number) => void;
}

export async function queryFim(
  prefix: string,
  suffix: string,
  signal: AbortSignal,
  progress?: FimProgress,
): Promise<string> {
  const cfg = vscode.workspace.getConfiguration("extension1");
  const endpoint = cfg.get<string>("endpoint", "http://localhost:11434/api/generate");
  const model = cfg.get<string>("model", "qwen2.5-coder:3b-base-q6_K");
  const numPredict = cfg.get<number>("maxTokens", 256);
  const temperature = cfg.get<number>("temperature", 0.2);

  const prompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      raw: true,
      options: {
        temperature,
        num_predict: numPredict,
        stop: FIM_STOP,
      },
    }),
  });

  if (!resp.ok) {
    throw new Error(`Ollama ${resp.status}: ${await resp.text()}`);
  }
  if (!resp.body) {
    throw new Error("Ollama: empty response body");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let tokens = 0;
  let finished = false;

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const chunk = JSON.parse(line) as { response?: string; done?: boolean };
        if (chunk.response) {
          accumulated += chunk.response;
          tokens++;
          progress?.onToken?.(accumulated, tokens);
        }
        if (chunk.done) {
          finished = true;
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated.replace(TOKEN_TAG, "");
}

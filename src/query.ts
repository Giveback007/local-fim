import * as vscode from "vscode";

const FIM_STOP = ["<|fim_pad|>", "<|endoftext|>", "<|repo_name|>", "<|file_sep|>", "<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>"];

export async function queryFim(
  prefix: string,
  suffix: string,
  signal: AbortSignal,
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
      stream: false,
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

  const data = (await resp.json()) as { response?: string };
  return (data.response ?? "").replace(/<\|[a-z_]+\|>/g, "");
}

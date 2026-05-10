import { streamFimLine } from "./utils/general.utils";

// TODO: re-add workspace config knobs (endpoint, model, maxTokens, temperature)
// TODO: re-add FIM stop tokens (<|fim_pad|>, <|endoftext|>, ...) via Ollama `stop` option
// TODO: re-add TOKEN_TAG cleanup (strip leaked <|...|> from output)

export interface FimProgress {
  onToken?: (accumulated: string, tokenCount: number) => void;
}

export async function queryFim(
  prefix: string,
  suffix: string,
  signal: AbortSignal,
  progress?: FimProgress,
): Promise<string> {
  let acc = "";
  let tokens = 0;

  const { stop, done } = await streamFimLine(
    { prefix, suffix },
    (t) => {
      acc += t;
      tokens++;
      progress?.onToken?.(acc, tokens);
    },
  );

  if (signal.aborted) stop();
  else signal.addEventListener("abort", () => stop(), { once: true });

  await done;
  return acc;
}

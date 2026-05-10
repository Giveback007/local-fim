import { MODEL, MODEL_TEMP } from "../config";
import type { FimText, OllamaDoneResponse, OllamaToken } from "../types/app";

async function pumpReader(
    reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
    onChunk: (bytes: Uint8Array) => void,
    onEnd?: () => void,
) {
    try {
        while (true) {
            const res = await reader.read();
            if (res.done) return onEnd?.();
            onChunk(res.value);
        }
    } catch (e) {
        if ((e as Error).name !== "AbortError") throw e;
        onEnd?.();   // treat abort as "stream ended"
    }
}

async function ollamaGenerate(inputText: FimText, stream = true) {
    const getPrompt = ({ prefix, suffix }: FimText) =>
        `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;

    const controller: AbortController = new AbortController();
    return {
        stop: () => controller.abort(),
        response: await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL,
                prompt: getPrompt(inputText),
                stream,
                raw: true, 
                options: {
                    temperature: MODEL_TEMP,
                    num_predict: 256
                },
            }),
            signal: controller.signal,
        })
    }
}

export async function streamFimLine(
    inputText: FimText,
    onToken: (token: string) => any,
    options: {
        onEnd?: (doneRes: OllamaDoneResponse) => any,
        nOfLines?: number;
    } = {}
) {
    const { onEnd, nOfLines = 1 } = options;
    const { response, stop } = await ollamaGenerate(inputText);
    if (!response.body) throw new Error("no body");

    const decoder = new TextDecoder();
    const reader = response.body.getReader();

    let acc = '';
    const done = pumpReader(reader, (bytes) => {
        const str = decoder.decode(bytes, { stream: true });
        const tokens: (OllamaToken | OllamaDoneResponse)[] = str
            .split("\n")
            .filter(s => s.trim())
            .map(s => JSON.parse(s));

        for (const o of tokens) {
            onToken(o.response);
            
            acc += o.response;
            const nlCount = (acc.trimStart().match(/\n/g) ?? []).length;
            if (nlCount >= nOfLines) return stop();
            if (o.done) return onEnd?.(o);
        }
    });

    return { stop, done };
}
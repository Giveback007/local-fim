import type { FimText, OllamaDoneResponse, OllamaToken } from "../types/app"
import { pumpReader } from "./general.utils";

export type FimConfig = {
    endpoint: string;
    model: string;
    maxTokens: number;
    temperature: number;
    ctxBudget: number;
    nOfLines: number;
};

export type HealthStatus = "ready" | "no-model" | "down";

export class OllamaClient {
    private baseUrl: string;
    private healthCheckItv: NodeJS.Timeout;
    onHealthChange?: (status: HealthStatus, reason: string) => void;

    constructor(private config: FimConfig) {
        this.baseUrl = this.deriveBaseUrl(config.endpoint);

        
        this.checkHealth()
        this.healthCheckItv = setInterval(this.checkHealth, 30_000);
    }

    updateConfig(config: FimConfig) {
        this.config = config;
        this.baseUrl = this.deriveBaseUrl(config.endpoint);
        this.checkHealth();
    }

    private deriveBaseUrl(endpoint: string): string {
        return endpoint.replace(/\/api\/.*$/, "");
    }

    checkHealth = async (): Promise<HealthStatus> => {
        let status: HealthStatus;
        let reason: string;
        try {
            const models = await this.listModels();
            if (models.includes(this.config.model)) {
                status = "ready";
                reason = `Model ${this.config.model} loaded`;
            } else {
                status = "no-model";
                reason = `Model ${this.config.model} not found. Available: ${models.join(", ") || "none"}`;
            }
        } catch {
            status = "down";
            reason = `Ollama not running at ${this.baseUrl}`;
        }
        console.log(`[HomeFIM] health: ${status}`);
        this.onHealthChange?.(status, reason);
        return status;
    }

    async cleanUp() {
        clearInterval(this.healthCheckItv);
    }

    async listModels(): Promise<string[]> {
        const res = await fetch(`${this.baseUrl}/api/tags`);
        if (!res.ok) throw new Error(`tags returned ${res.status}`);
        const data = (await res.json()) as { models: { name: string }[] };
        return data.models.map(m => m.name);
    }

    async generate(inputText: FimText, stream = true) {
        const prompt = `<|fim_prefix|>${inputText.prefix}<|fim_suffix|>${inputText.suffix}<|fim_middle|>`;
        const controller = new AbortController();

        return {
            stop: () => controller.abort(),
            response: await fetch(this.config.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.config.model,
                    prompt,
                    stream,
                    raw: true,
                    options: {
                        temperature: this.config.temperature,
                        num_predict: this.config.maxTokens,
                    },
                }),
                signal: controller.signal,
            }),
        };
    }

    async streamLines(
        inputText: { prefix: string; suffix: string },
        onToken: (token: string) => any,
        options: {
            onEnd?: (doneRes: OllamaDoneResponse) => any;
            nOfLines?: number;
        } = {}
    ) {
        const { onEnd, nOfLines = 1 } = options;
        const { response, stop } = await this.generate(inputText);
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
}
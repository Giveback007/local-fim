export type FimText = { prefix: string; suffix: string; };

export type OllamaBase = {
    model: string;
    created_at: string;
    response: string;
}
export type OllamaToken = {
    done: false;
} & OllamaBase

export type OllamaDoneResponse = {
    done: true;
    done_reason: 'stop';
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;
} & OllamaBase;
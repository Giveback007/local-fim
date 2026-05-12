import {
    type TextDocument, type InlineCompletionContext, type CancellationToken,
    type InlineCompletionItemProvider, type ExtensionContext,

    Position, Range, InlineCompletionTriggerKind, InlineCompletionItem,
    workspace, window, languages, commands,
} from "vscode";

import { StatusBar } from "./utils/extension.utils";
import { OllamaClient, type FimConfig } from "./utils/ollama.client";

function readFimConfig(): FimConfig {
    const cfg = workspace.getConfiguration("homeFim");
    return {
        endpoint: cfg.get<string>("endpoint", "http://localhost:11434/api/generate"),
        model: cfg.get<string>("model", "qwen2.5-coder:3b-base-q6_K"),
        maxTokens: cfg.get<number>("maxTokens", 256),
        temperature: cfg.get<number>("temperature", 0.2),
        ctxBudget: cfg.get<number>("contextChars", 4000),
        nOfLines: cfg.get<number>("nOfLines", 1)
    };
}

function buildContext(doc: TextDocument, pos: Position, budget: number): { prefix: string; suffix: string } {
    const half = Math.max(256, Math.floor(budget / 2));
    const head = new Position(0, 0);
    const tail = doc.lineAt(doc.lineCount - 1).range.end;
    const fullPrefix = doc.getText(new Range(head, pos));
    const fullSuffix = doc.getText(new Range(pos, tail));
    const prefix = fullPrefix.length > half ? fullPrefix.slice(fullPrefix.length - half) : fullPrefix;
    const suffix = fullSuffix.length > half ? fullSuffix.slice(0, half) : fullSuffix;
    return { prefix, suffix };
}

class FimProvider implements InlineCompletionItemProvider {

    constructor(
        private status: StatusBar,
        private client: OllamaClient,
    ) { }

    stopGeneration = () => { }

    async provideInlineCompletionItems(
        document: TextDocument,
        position: Position,
        context: InlineCompletionContext,
        cancellationToken: CancellationToken,
    ) {
        if (context.triggerKind !== InlineCompletionTriggerKind.Invoke) {
            this.stopGeneration();
            return [];
        }

        this.status.start();

        const { ctxBudget, nOfLines } = readFimConfig();
        const ctx = buildContext(document, position, ctxBudget);

        let tokens = 0;
        let acc = '';
        const { stop, done } = await this.client.streamLines(ctx, async tkn => {
            acc += tkn;
            this.status.progress(++tokens);
        }, { nOfLines });
        cancellationToken.onCancellationRequested(stop);
        this.stopGeneration = stop;
        await done;
        this.status.stop();

        console.log(`[${JSON.stringify(acc)}]`);
        if (cancellationToken.isCancellationRequested) return [];

        const cleaned = acc.replace(/\n+$/, '');
        return [new InlineCompletionItem(cleaned, new Range(position, position))];
    }
}

function getConfigurationUi(ollama: OllamaClient) {
    return commands.registerCommand("homeFim.configure", async () => {
        const pick = await window.showQuickPick([
            { label: "$(symbol-method) Change Model", id: "model" },
            { label: "$(list-ordered) Max Lines", id: "lines" },
            { label: "$(flame) Temperature", id: "temperature" },
            { label: "$(symbol-numeric) Max Tokens", id: "maxTokens" },
            { label: "$(file-code) Context Size", id: "contextChars" },
            { label: "$(keyboard) Configure Keybindings", id: "keybindings" },
        ] as const, { placeHolder: "HomeFIM Configuration" });

        if (!pick) return;
        const cfg = workspace.getConfiguration("homeFim");

        switch (pick.id) {
            case "model": {
                let models: string[];
                try {
                    models = await ollama.listModels();
                } catch {
                    window.showErrorMessage("HomeFIM: Can't reach Ollama");
                    return;
                }
                const selected = await window.showQuickPick(
                    models.map(m => ({ label: m, picked: m === cfg.get("model") })),
                    { placeHolder: "Select model" }
                );
                if (selected) await cfg.update("model", selected.label, true);
                break;
            }
            case "lines":
            case "temperature":
            case "maxTokens":
            case "contextChars": {
                const { key, prompt } = {
                    lines:       { key: "nOfLines",     prompt: "Max lines per completion" },
                    temperature: { key: "temperature",  prompt: "Temperature (0-1)" },
                    maxTokens:   { key: "maxTokens",    prompt: "Max tokens (num_predict)" },
                    contextChars:{ key: "contextChars",  prompt: "Context budget (chars)" },
                }[pick.id];
                
                const val = await window.showInputBox({
                    prompt,
                    value: String(cfg.get(key)),
                    validateInput: v => isNaN(Number(v)) ? "Must be number" : undefined,
                });
                if (val !== undefined) await cfg.update(key, Number(val), true);
                break;
            }
            case "keybindings":
                commands.executeCommand("workbench.action.openGlobalKeybindings", "homeFim");
                break;
        }
    });
}

export function activate(context: ExtensionContext) {
    // Use this if you want auto open dev-tools:
    // if (context.extensionMode === ExtensionMode.Development)
    //     commands.executeCommand('workbench.action.toggleDevTools');

    const ollama = new OllamaClient(readFimConfig());
    const status = new StatusBar();
    const configure = getConfigurationUi(ollama)

    // Wire health → StatusBar
    ollama.onHealthChange = (s, reason) => status.setHealth(s, reason);

    const provider = new FimProvider(status, ollama);
    const reg = languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider);

    const trigger = commands.registerCommand("homeFim.trigger", () => {
        commands.executeCommand("editor.action.inlineSuggest.trigger");
    });

    const acceptAndContinue = commands.registerCommand("homeFim.acceptAndContinue", async () => {
        await commands.executeCommand("editor.action.inlineSuggest.commit");
        await commands.executeCommand("homeFim.trigger");
    });

    const onConfigChange = workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("homeFim")) ollama.updateConfig(readFimConfig());
    });

    const dismissTriggers = [
        window.onDidChangeWindowState,
        window.onDidChangeActiveTextEditor,
        workspace.onDidCloseTextDocument,
        window.onDidChangeTextEditorSelection,
    ].map(fn => fn(provider.stopGeneration));

    context.subscriptions.push(
        reg, trigger, acceptAndContinue, configure, status, onConfigChange, ...dismissTriggers,
        { dispose: () => ollama.cleanUp() },
    );
}

export function deactivate() { }
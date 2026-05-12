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

export function activate(context: ExtensionContext) {
    // Use this if you want auto open dev-tools:
    // if (context.extensionMode === ExtensionMode.Development)
    //     commands.executeCommand('workbench.action.toggleDevTools');

    const client = new OllamaClient(readFimConfig());
    const status = new StatusBar();
    const provider = new FimProvider(status, client);
    const reg = languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider);

    const trigger = commands.registerCommand("homeFim.trigger", () => {
        commands.executeCommand("editor.action.inlineSuggest.trigger");
    });

    // Refresh client config when settings change
    const onConfigChange = workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("homeFim")) client.updateConfig(readFimConfig())
    });

    const dismissTriggers = [
        window.onDidChangeWindowState,          // onFocus
        window.onDidChangeActiveTextEditor,     // onActive
        workspace.onDidCloseTextDocument,       // onClose
        window.onDidChangeTextEditorSelection,  // onSel
    ].map(fn => fn(provider.stopGeneration));

    context.subscriptions.push(
        reg, trigger, status, onConfigChange, ...dismissTriggers,
        { dispose: () => client.cleanUp() },
    );
}

export function deactivate() { }
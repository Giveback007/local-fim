import {
    type TextDocument, type InlineCompletionContext, type CancellationToken,
    type InlineCompletionItemProvider,
    type ExtensionContext,
    Position, Range, InlineCompletionTriggerKind, InlineCompletionItem,
    workspace, window, languages, commands,
} from "vscode";

import { StatusBar } from "./utils/extension.utils";
import { streamFimLine } from "./utils/general.utils";

const DEFAULT_CONTEXT_CHARS = 4000;

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

    constructor(private status: StatusBar) { }

    stopGeneration = () => { }

    async provideInlineCompletionItems(
        document: TextDocument,
        position: Position,
        context: InlineCompletionContext,
        cancellationToken: CancellationToken,
    ) {
        if (context.triggerKind !== InlineCompletionTriggerKind.Invoke) {
            console.log("SKIP")
            this.stopGeneration()
            return [];
        }

        this.status.start();

        const cfg = workspace.getConfiguration("homeFim");
        const budget = cfg.get<number>("contextChars", DEFAULT_CONTEXT_CHARS);
        const ctx = buildContext(document, position, budget);

        let tokens = 0;
        let acc = ''
        const { stop, done } = await streamFimLine(ctx, async tkn => {
            acc += tkn;
            this.status.progress(++tokens)
        }, { nOfLines: 1 });
        cancellationToken.onCancellationRequested(stop);
        this.stopGeneration = stop;
        await done;

        console.log(`[${JSON.stringify(acc)}]`)

        this.status.stop();
        const cleaned = acc.replace(/\n+$/, '');
        return [new InlineCompletionItem(cleaned, new Range(position, position))];
    }
}

export function activate(context: ExtensionContext) {
    // if (context.extensionMode === ExtensionMode.Development)
    //     commands.executeCommand('workbench.action.toggleDevTools');

    const status = new StatusBar();
    const provider = new FimProvider(status);
    const reg = languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider);

    const trigger = commands.registerCommand("homeFim.trigger", () => {
        commands.executeCommand("editor.action.inlineSuggest.trigger");
    });

    const onFocus = window.onDidChangeWindowState
    const onActive = window.onDidChangeActiveTextEditor
    const onClose = workspace.onDidCloseTextDocument
    const onSel = window.onDidChangeTextEditorSelection

    const dismissTriggers = [
        onFocus, onActive, onClose, onSel
    ].map(fn => fn(provider.stopGeneration))

    context.subscriptions.push(reg, trigger, status, ...dismissTriggers);
}

export function deactivate() { }

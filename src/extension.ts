import * as vscode from "vscode";
import { queryFim } from "./query";

const DEFAULT_CONTEXT_CHARS = 4000;

function buildContext(doc: vscode.TextDocument, pos: vscode.Position, budget: number): { prefix: string; suffix: string } {
  const half = Math.max(256, Math.floor(budget / 2));
  const head = new vscode.Position(0, 0);
  const tail = doc.lineAt(doc.lineCount - 1).range.end;
  const fullPrefix = doc.getText(new vscode.Range(head, pos));
  const fullSuffix = doc.getText(new vscode.Range(pos, tail));
  const prefix = fullPrefix.length > half ? fullPrefix.slice(fullPrefix.length - half) : fullPrefix;
  const suffix = fullSuffix.length > half ? fullSuffix.slice(0, half) : fullSuffix;
  return { prefix, suffix };
}

class StatusBar {
  private item: vscode.StatusBarItem;
  private active = 0;
  private startedAt = 0;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.idle();
    this.item.show();
  }

  private idle() {
    this.item.text = "$(sparkle) FIM";
    this.item.tooltip = "FIM idle";
  }

  start() {
    this.active++;
    this.startedAt = Date.now();
    this.item.text = "$(sync~spin) FIM 0";
    this.item.tooltip = "FIM generating…";
  }

  progress(tokens: number) {
    const secs = Math.max(0.001, (Date.now() - this.startedAt) / 1000);
    const tps = (tokens / secs).toFixed(1);
    this.item.text = `$(sync~spin) FIM ${tokens} (${tps} t/s)`;
  }

  stop() {
    this.active = Math.max(0, this.active - 1);
    if (this.active === 0) this.idle();
  }

  dispose() {
    this.item.dispose();
  }
}

class FimProvider implements vscode.InlineCompletionItemProvider {
  private inflight: AbortController | null = null;

  constructor(private status: StatusBar) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    if (context.triggerKind !== vscode.InlineCompletionTriggerKind.Invoke) return [];

    this.inflight?.abort();
    const ac = new AbortController();
    this.inflight = ac;
    token.onCancellationRequested(() => ac.abort());

    const cfg = vscode.workspace.getConfiguration("homeFim");
    const budget = cfg.get<number>("contextChars", DEFAULT_CONTEXT_CHARS);
    const { prefix, suffix } = buildContext(document, position, budget);

    this.status.start();
    try {
      const completion = await queryFim(prefix, suffix, ac.signal, {
        onToken: (_text, n) => this.status.progress(n),
      });
      if (!completion || token.isCancellationRequested) return [];
      return [new vscode.InlineCompletionItem(completion)];
    } catch (err) {
      if (ac.signal.aborted) return [];
      vscode.window.showErrorMessage(`FIM: ${(err as Error).message}`);
      return [];
    } finally {
      this.status.stop();
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const status = new StatusBar();
  const provider = new FimProvider(status);
  const reg = vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider);

  const trigger = vscode.commands.registerCommand("homeFim.trigger", () => {
    vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
  });

  context.subscriptions.push(reg, trigger, status);
}

export function deactivate() {}

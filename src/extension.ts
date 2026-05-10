import * as vscode from "vscode";
import { queryFim } from "./query";

const WINDOW_RADIUS = 50;

function buildContext(doc: vscode.TextDocument, pos: vscode.Position): { prefix: string; suffix: string } {
  const startLine = Math.max(0, pos.line - WINDOW_RADIUS);
  const endLine = Math.min(doc.lineCount - 1, pos.line + WINDOW_RADIUS);
  const prefix = doc.getText(new vscode.Range(new vscode.Position(startLine, 0), pos));
  const suffix = doc.getText(new vscode.Range(pos, doc.lineAt(endLine).range.end));
  return { prefix, suffix };
}

class StatusBar {
  private item: vscode.StatusBarItem;
  private active = 0;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.text = "$(sparkle) FIM";
    this.item.tooltip = "FIM idle";
    this.item.show();
  }

  start() {
    this.active++;
    this.item.text = "$(sync~spin) FIM";
    this.item.tooltip = "FIM generating…";
  }

  stop() {
    this.active = Math.max(0, this.active - 1);
    if (this.active === 0) {
      this.item.text = "$(sparkle) FIM";
      this.item.tooltip = "FIM idle";
    }
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

    const { prefix, suffix } = buildContext(document, position);

    this.status.start();
    try {
      const completion = await queryFim(prefix, suffix, ac.signal);
      if (!completion || token.isCancellationRequested) return [];
      const item = new vscode.InlineCompletionItem(completion);
      item.range = new vscode.Range(position, position);
      return [item];
    } catch (err) {
      if ((err as Error).name === "AbortError") return [];
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

  const trigger = vscode.commands.registerCommand("extension1.fim", () => {
    vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
  });

  context.subscriptions.push(reg, trigger, status);
}

export function deactivate() {}

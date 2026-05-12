import type { StatusBarItem } from "vscode";

import { window, StatusBarAlignment } from "vscode";

export class StatusBar {
    private item: StatusBarItem;
    // private active = 0;
    private startedAt: number | null = null;
    private tps = 0;

    constructor() {
        this.item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
        this.idle();
        this.item.show();
    }

    private idle() {
        this.item.text = `$(sparkle) FIM (${this.tps.toFixed(1)} t/s)`;
        this.item.tooltip = "FIM idle";
    }

    start() {
        this.startedAt = null;
        this.item.text = "$(sync~spin) FIM 0";
        this.item.tooltip = "FIM generating…";
    }

    progress(tokens: number) {
        if (!this.startedAt) this.startedAt = Date.now() - 50;
        const secs = (Date.now() - this.startedAt) / 1000;
        this.tps = tokens / secs;
        this.item.text = `$(sync~spin) FIM ${tokens} (${this.tps.toFixed(1)} t/s)`;
    }

    stop = () => this.idle()
    dispose = () => this.item.dispose();
}
import type { StatusBarItem } from "vscode";
import type { HealthStatus } from "./ollama.client";

import { window, StatusBarAlignment } from "vscode";

const healthDisplay: Record<HealthStatus, { icon: string; label: string }> = {
    ready:    { icon: "$(sparkle)",  label: "FIM Ready" },
    "no-model": { icon: "$(warning)", label: "FIM No Model" },
    down:     { icon: "$(error)",    label: "FIM Offline" },
};

export class StatusBar {
    private item: StatusBarItem;
    private startedAt: number | null = null;
    private tps = 0;
    private health: HealthStatus = "down";
    private healthReason = "";

    constructor() {
        this.item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
        this.idle();
        this.item.show();
    }

    setHealth(status: HealthStatus, reason = "") {
        this.health = status;
        this.healthReason = reason;
        this.idle();
    }

    private idle() {
        const { icon, label } = healthDisplay[this.health];
        const tpsStr = this.tps > 0 ? ` (${this.tps.toFixed(1)} t/s)` : "";
        this.item.text = `${icon} ${label}${tpsStr}`;
        this.item.tooltip = this.healthReason || label;
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

    stop = () => this.idle();
    dispose = () => this.item.dispose();
}
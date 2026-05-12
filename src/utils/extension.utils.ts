// extension.utils.ts
import type { StatusBarItem } from "vscode";
import type { HealthStatus } from "./ollama.client";

import { window, StatusBarAlignment, MarkdownString } from "vscode";

const healthDisplay: Record<HealthStatus, { icon: string; label: string }> = {
    ready:    { icon: "$(sparkle)",  label: "FIM Ready" },
    "no-model": { icon: "$(warning)", label: "FIM No Model" },
    down:     { icon: "$(error)",    label: "FIM Offline" },
};

class Telemetry {
    totalCompletions = 0;
    private totalTokens = 0;
    private totalLatencyMs = 0;
    private totalTps = 0;
    private sessionStart = new Date();
    private totalStartLtcMs = 0;

    record(rec: {
        tokens: number, 
        latencyMs: number,
        startLtc: number,
    }) {
        this.totalCompletions++;
        this.totalTokens += rec.tokens;
        this.totalLatencyMs += rec.latencyMs;
        this.totalStartLtcMs += rec.startLtc;

        if (rec.latencyMs > 0)
            this.totalTps += rec.tokens / (rec.latencyMs / 1000);
    }

    get avgStartMs(): number {
        return this.totalStartLtcMs / this.totalCompletions;
    }

    get avgLatencyMs(): number {
        return this.totalCompletions ? this.totalLatencyMs / this.totalCompletions : 0;
    }

    get avgTps(): number {
        return this.totalCompletions ? this.totalTps / this.totalCompletions : 0;
    }

    toMarkdown(): MarkdownString {
        const elapsed = Math.floor((Date.now() - this.sessionStart.getTime()) / 60000);
        const md = new MarkdownString();

        md.appendMarkdown([
            `**HomeFIM Session** (${elapsed} min)\n`,
            `| Stat | Value |`,
            `|------|-------|`,
            `| Ttl Cml | ${this.totalCompletions} |`,
            `| Ttl Tks | ${this.totalTokens} |`,
            `| Avg Srt | ${this.avgStartMs.toFixed(0)} ms |`,
            `| Avg Ltc | ${this.avgLatencyMs.toFixed(0)} ms |`,
            `| Avg t/s | ${this.avgTps.toFixed(1)} t/s |`,
        ].join("\n"));
        return md;
    }
}

export class StatusBar {
    private item: StatusBarItem;
    private startedAt: number | null = null;
    private lastTokenCount = 0;
    private tps = 0;
    private health: HealthStatus = "down";
    private healthReason = "";
    private telemetry = new Telemetry();

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
        this.item.tooltip = this.telemetry.totalCompletions > 0
            ? this.telemetry.toMarkdown()
            : this.healthReason || label;
    }

    startLatency = 0;
    start() {
        this.startedAt = null;
        this.startLatency = Date.now();
        this.lastTokenCount = 0;
        this.item.text = "$(sync~spin) FIM 0";
        this.item.tooltip = "FIM generating…";
    }

    progress(tokens: number) {
        if (!this.startedAt) {
            this.startLatency = Date.now() - this.startLatency;
            this.startedAt = Date.now() - 50;
        }
        this.lastTokenCount = tokens;
        const secs = (Date.now() - this.startedAt) / 1000;
        this.tps = tokens / secs;
        this.item.text = `$(sync~spin) FIM ${tokens} (${this.tps.toFixed(1)} t/s)`;
    }

    stop() {
        if (this.startedAt && this.lastTokenCount > 0) {
            const latency = Date.now() - this.startedAt;
            this.telemetry.record({
                tokens: this.lastTokenCount,
                latencyMs: latency,
                startLtc: this.startLatency,
            });
        }
        this.idle();
    }

    dispose = () => this.item.dispose();
}
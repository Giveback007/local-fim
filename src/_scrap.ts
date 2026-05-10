import { streamFimLine } from "./utils/general.utils";

// ! file to test functionality without running vs-code

const log = console.log;

async function triggerStream() {
    console.time('TIMER')
    const prefix = `// Utility functions for detecting distance between two gps cords

export function harvestimeDistance(`;
    const suffix = `}`;
    log("---STREAMING---");
    const { done, stop } = await streamFimLine({ prefix, suffix }, token => {
        process.stdout.write(token)
    }, { nOfLines: 1, onEnd: log });

    await done;
    log("\n---DONE---");
    console.timeEnd('TIMER')
}


triggerStream();
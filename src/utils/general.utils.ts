export async function pumpReader(
    reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
    onChunk: (bytes: Uint8Array) => void,
    onEnd?: () => void,
) {
    try {
        while (true) {
            const res = await reader.read();
            if (res.done) return onEnd?.();
            onChunk(res.value);
        }
    } catch (e) {
        if ((e as Error).name !== "AbortError") throw e;
        onEnd?.();
    }
}
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const logRebuildPlugin = {
    name: "log-rebuild",
    setup(build) {
        build.onStart(() => {
            console.log(`[${new Date().toISOString()}] rebuild triggered`);
        });
    },
};

const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "out/extension.js",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    sourcemap: true,
    plugins: [logRebuildPlugin],
});

if (watch) {
    await ctx.watch();
    console.log("watching...");
} else {
    await ctx.rebuild();
    await ctx.dispose();
}

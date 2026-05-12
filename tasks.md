# HomeFIM Improvement Plan

## Step 1: Wire Up All Settings (Kill Hardcodes)

**Problem:** `config.ts` hardcodes `MODEL` and `MODEL_TEMP`. `ollamaGenerate` ignores `homeFim.model`, `homeFim.temperature`, `homeFim.maxTokens`, `homeFim.endpoint` from package.json.

**Changes:**
- Delete `src/config.ts`
- Create `src/utils/config.utils.ts` — reads all settings from `workspace.getConfiguration("homeFim")` into a typed object
- Export a `getConfig()` function returning `{ endpoint, model, maxTokens, temperature, contextChars }`
- Update `ollamaGenerate` in `general.utils.ts` to accept config params instead of importing hardcoded constants
- Update `extension.ts` to pass config into `streamFimLine`
- Add `onDidChangeConfiguration` listener so config refreshes without restart

---

## Step 2: Create `OllamaClient` Class

**Problem:** No health check, no model discovery, fetch logic scattered in `general.utils.ts`.

**Changes:**
- Create `src/utils/ollama.client.ts`
- Class `OllamaClient` with:
  - `endpoint` from config
  - `checkHealth(): Promise<'down' | 'no-model' | 'ready'>` — calls `GET {endpoint}/api/tags`, checks if configured model exists
  - `listModels(): Promise<string[]>` — parses `/api/tags` response, returns model names
  - `generate(input: FimText, config): Promise<{stop, response}>` — moved from `ollamaGenerate`
- Move `streamFimLine` into `OllamaClient` or keep separate but have it use the client
- Run health check on `activate()`, then poll every 60s
- Note: endpoint config is `http://localhost:11434/api/generate` but health/tags calls need base URL `http://localhost:11434`. Derive base from endpoint or add separate base URL logic.

---

## Step 3: Enhanced StatusBar

**Problem:** StatusBar only shows generating/idle. No health state, no telemetry, no click action.

**Changes:**

### 3a: Health State Display
- Three states: `$(error) FIM Offline`, `$(warning) FIM No Model`, `$(sparkle) FIM Ready`
- `StatusBar` receives health status from `OllamaClient` and updates icon/text
- Tooltip shows reason (e.g. "Ollama not running at localhost:11434" or "Model qwen2.5-coder:3b not found")

### 3b: Telemetry on Hover
- Track in `StatusBar` or separate `Telemetry` object:
  - `totalCompletions: number`
  - `acceptedCompletions: number` (need to detect acceptance — see note)
  - `totalTokens: number`
  - `avgLatencyMs: number`
  - `avgTps: number`
  - `sessionStart: Date`
- `StatusBarItem.tooltip` = `MarkdownString` with formatted stats table
- Note on accepted count: VSCode doesn't fire event on inline suggestion accept. Options:
  - Track if cursor moved to end of suggestion range after showing it (heuristic)
  - Or skip accept tracking for now, track only total completions/tokens/latency/tps

### 3c: Click → QuickPick Config
- Set `StatusBarItem.command` to `homeFim.configure`
- Register `homeFim.configure` command
- Shows QuickPick menu:
  1. **Change Model** → fetch `OllamaClient.listModels()` → QuickPick list → writes `homeFim.model`
  2. **Max Lines** → InputBox (number) → writes `homeFim.nOfLines` (new setting, see Step 5)
  3. **Temperature** → InputBox (number) → writes `homeFim.temperature`
  4. **Max Tokens** → InputBox (number) → writes `homeFim.maxTokens`
  5. **Context Size** → InputBox (number) → writes `homeFim.contextChars`
  6. **Configure Keybindings** → opens keybindings UI filtered to `homeFim`

---

## Step 4: Tab = Accept + Continue

**Problem:** Tab accepts suggestion and stops. Want Tab to accept then immediately trigger next FIM.

**Changes:**
- Register new command `homeFim.acceptAndContinue`
- Implementation:
  ```ts
  commands.registerCommand("homeFim.acceptAndContinue", async () => {
      await commands.executeCommand("editor.action.inlineSuggest.commit");
      await commands.executeCommand("homeFim.trigger");
  });
  ```
- Update keybinding in `package.json`: change Tab binding from `editor.action.inlineSuggest.commit` to `homeFim.acceptAndContinue`
- Escape remains bound to dismiss (default VSCode behavior, no change needed)

---

## Step 5: Expose `nOfLines` as Setting

**Problem:** `nOfLines` hardcoded to 1 in `extension.ts`. Needed for QuickPick config and general flexibility.

**Changes:**
- Add to `package.json` contributes.configuration:
  ```json
  "homeFim.nOfLines": {
      "type": "number",
      "default": 1,
      "description": "Number of lines to generate per completion."
  }
  ```
- Read from config in `extension.ts`, pass to `streamFimLine`

---

## Execution Order

1. **Step 1** — foundation, everything else depends on config being wired
2. **Step 2** — OllamaClient, needed for health + model list
3. **Step 5** — quick, add nOfLines setting before StatusBar references it
4. **Step 3a** — health state in StatusBar
5. **Step 3b** — telemetry hover
6. **Step 3c** — QuickPick config UI
7. **Step 4** — Tab chaining


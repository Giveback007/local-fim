# HomeFIM Improvement Plan

## Step 3: Enhanced StatusBar

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
  2. **Max Lines** → InputBox (number) → writes `homeFim.nOfLines`
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

## Execution Order

1. ~~Step 1~~ ✓
2. ~~Step 2~~ ✓
3. ~~Step 5~~ ✓
4. ~~Step 3a~~ ✓
5. **Step 3b** — telemetry hover ← next
6. **Step 3c** — QuickPick config UI
7. **Step 4** — Tab chaining
# HomeFIM Improvement Plan

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
5. ~~Step 3b~~ ✓
6. ~~Step 3c~~ ✓
7. **Step 4** — Tab chaining
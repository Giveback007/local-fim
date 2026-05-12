#!/bin/bash
# Moves the VS Code "Extension Development Host" window to workspace 1 (0-indexed).
# Requires the GNOME "Window Calls" extension.

WORKSPACE=1
TITLE_MATCH="Extension Development Host"
DEST=org.gnome.Shell
PATH_=/org/gnome/Shell/Extensions/Windows
IFACE=org.gnome.Shell.Extensions.Windows

# Wait up to 15s for the window to appear.
for i in $(seq 1 15); do
  WINS=$(gdbus call --session --dest "$DEST" --object-path "$PATH_" --method "$IFACE.List" 2>/dev/null)
  IDS=$(echo "$WINS" | grep -oP '"id":\s*\K[0-9]+')
  for ID in $IDS; do
    TITLE=$(gdbus call --session --dest "$DEST" --object-path "$PATH_" --method "$IFACE.GetTitle" "$ID" 2>/dev/null)
    if echo "$TITLE" | grep -q "$TITLE_MATCH"; then
      gdbus call --session --dest "$DEST" --object-path "$PATH_" --method "$IFACE.MoveToWorkspace" "$ID" "$WORKSPACE" >/dev/null 2>&1
      exit 0
    fi
  done
  sleep 1
done
exit 1

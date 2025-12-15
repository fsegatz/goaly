---
description: how to commit and push changes
---

# Committing and Pushing Changes

When committing and pushing changes, follow these steps:

## 1. Stage all changes
```bash
git add .
```

## 2. Commit with a descriptive message
```bash
git commit -m "Type: Brief description of changes"
```
- Use conventional commit types: `Fix:`, `Feature:`, `Refactor:`, `Update:`, etc.
- Keep the message concise but descriptive
- For multi-line messages, use multiple `-m` flags:
```bash
git commit -m "Fix: Main description" -m "Additional details" -m "More context"
```

## 3. Push to remote repository
```bash
git push
```
- If pushing a new branch for the first time, use:
```bash
git push -u origin <branch-name>
```

**Note:** On Windows, if using PowerShell, you can run these commands directly. If using `cmd`, wrap commands with `cmd /c` when needed.

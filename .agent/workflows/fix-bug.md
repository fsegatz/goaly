---
description: how to fix a bug from a GitHub issue
---

# Process for Fixing Bugs

When implementing a bug fix from a GitHub issue, follow this structured process:

## 0. Before Starting Work
```bash
git checkout main
git pull
git checkout -b fix/issue-<number>
```

## 1. Reproduce the Bug
- Read and understand the issue requirements
- Start the development server: `npx --yes serve -l 8000`
- **Use browser testing mode to reproduce the bug before implementing any fixes**
- Document the reproduction steps and confirm the bug exists
- Take note of the expected vs actual behaviour

## 2. Initial Implementation
- Create a TODO list to track progress
- Implement the fix
- Update tests to cover the bug scenario
- Run `npm test` to ensure all tests pass
- Check test coverage threshold (80% for statements, branches, functions, and lines)
- **Important:** Add sufficient tests to meet coverage thresholds
- Make the first commit with a descriptive message

## 3. Verify the Fix
- **Use browser testing mode to verify the bug is fixed**
- Confirm the expected behaviour now works correctly
- Test related functionality to ensure no regressions

## 4. Review and Improve
- Review the implementation for potential improvements
- Add additional test coverage for edge cases
- Ensure test coverage threshold is met (run `npm test` to verify)
- Make a second commit with improvements if needed

## 5. Create PR and Push
- Inform the developer that the server is running and wait for their confirmation
- Once confirmed, proceed with creating the PR:
```bash
git checkout fix/issue-<number>  # if not already
git add .
git commit -m "Fix: Description" -m "Details..." -m "Fixes #<number>"
git push -u origin fix/issue-<number>
```
- Provide the PR creation link to the developer
- Reference the issue number in the PR description and commit message

## 6. Documentation
- Update `AGENTS.md` or relevant documentation if the process changes
- Ensure all changes are properly documented

# Agents Handbook

This handbook summarises how coding agents and new contributors collaborate productively on the `goaly` project.

## Setup & Development
- Run `npm install` once to install dependencies.
- Serve the app locally with `npx --yes serve -l 8000` (see `README.md` for alternatives).
- The entry point is `index.html` with `src/app.js`.
- **Windows Note:** On Windows, Cursor should use `cmd` instead of PowerShell for terminal commands. Use `cmd /c <command>` when running commands on Windows.

## Tests & Quality
- Execute `npm test` for unit tests; add `-- --coverage` for a coverage report.
- **Important:** Always run `npm test` directly without piping output through filters (e.g., `findstr`, `grep`) for parsing. This ensures accurate test results and coverage reporting.
- **Command Usage:** Always use `npm test` without extra flags or piping. Run the command as-is: `npm test`. Do not add flags or pipe output to other commands.
- Maintain the existing high coverage; extend tests for new UI behaviour (`tests/ui-controller.test.js`).
- After code changes run `read_lints` in Cursor for touched files.

## Architecture Overview
- `src/domain`: pure logic (goal, settings, review services).
- `src/ui/ui-controller.js`: DOM coordination and rendering logic.
- `styles/styles.css`: global styling with responsive layout.
- `src/language`: language resources and localisation service.

## Working Guidelines
1. Review existing tests before implementing changes to understand expected behaviour.
2. Work incrementally; run tests after significant edits.
3. Do **not** overwrite user changes in a dirty worktree.
4. Summarise results clearly in commits/PRs and call out next steps.
5. Update the documentation whenever functionality changes.
6. Raise a PR when work is complete and hand it off for review.
7. **Naming rule:** Use English-only identifiers, function names and terminology across the codebase and documentation. This ensures consistency and simplifies future contributions.

## Committing and Pushing Changes

When committing and pushing changes, follow these steps:

1. **Stage all changes**
   ```bash
   git add .
   ```

2. **Commit with a descriptive message**
   ```bash
   git commit -m "Type: Brief description of changes"
   ```
   - Use conventional commit types: `Fix:`, `Feature:`, `Refactor:`, `Update:`, etc.
   - Keep the message concise but descriptive
   - For multi-line messages, use multiple `-m` flags:
     ```bash
     git commit -m "Fix: Main description" -m "Additional details" -m "More context"
     ```

3. **Push to remote repository**
   ```bash
   git push
   ```
   - If pushing a new branch for the first time, use:
     ```bash
     git push -u origin <branch-name>
     ```

**Note:** On Windows, if using PowerShell, you can run these commands directly. If using `cmd`, wrap commands with `cmd /c` when needed.

## Process for Fixing Issues

When implementing a GitHub issue, follow this structured process:

0. **Before Starting Work**
   - Checkout main branch: `git checkout main`
   - Pull latest changes: `git pull`
   - Create a feature branch: `git checkout -b feature/issue-<number>`

1. **Initial Implementation**
   - Read and understand the issue requirements
   - Create a TODO list to track progress
   - Implement the required changes
   - Update tests to cover new functionality
   - Run `npm test` to ensure all tests pass
   - Check test coverage threshold (80% for statements, branches, functions, and lines)
   - **Important:** Add sufficient tests to meet coverage thresholds. If coverage is below 80%, add additional tests for uncovered code paths, edge cases, and error handling until the threshold is met.
   - Make the first commit with a descriptive message

2. **Review and Improve**
   - Review the implementation for potential improvements
   - Add additional test coverage for edge cases
   - Ensure test coverage threshold is met (run `npm test` to verify)
   - Make a second commit with improvements

3. **Create PR and Push**
   - Start the development server: `npx --yes serve -l 8000` (run in background)
   - Inform the developer that the server is running and wait for their confirmation
   - Once confirmed, proceed with creating the PR:
     - Ensure you're on the feature branch: `git checkout feature/issue-<number>` (if not already)
     - Stage all changes: `git add .`
     - Commit with a descriptive message: `git commit -m "Feature: Description" -m "Details..." -m "Fixes #<number>"`
     - Push the branch: `git push -u origin feature/issue-<number>`
     - Provide the PR creation link to the developer
   - Reference the issue number in the PR description and commit message

4. **Documentation**
   - Update `AGENTS.md` or relevant documentation if the process changes
   - Ensure all changes are properly documented

**Example workflow:**
```bash
# 1. Create feature branch
git checkout main
git pull
git checkout -b feature/issue-<number>

# 2. Implement changes and make first commit
git add -A
git commit -m "Feature: Implement issue #<number>: Description of changes"

# 3. Review, improve, and make second commit (optional)
git add -A
git commit -m "Review and improve: Add additional test coverage"

# 4. Start server for developer confirmation
npx --yes serve -l 8000  # Run in background
# Wait for developer confirmation

# 5. Push and create PR
git add .
git commit -m "Feature: Final description" -m "Details..." -m "Fixes #<number>"
git push -u origin feature/issue-<number>
# Provide PR creation link to developer
```

## Reference Material
- Product expectations: `README.md` and the documents in `docs/`.
- Feature priorities: consult project documents first, then ask if unclear.

Happy hacking! 🚀


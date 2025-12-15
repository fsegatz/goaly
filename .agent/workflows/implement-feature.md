---
description: how to implement a feature from a GitHub issue
---

# Process for Implementing Features

When implementing a feature from a GitHub issue, follow this structured process:

## 0. Before Starting Work
```bash
git checkout main
git pull
git checkout -b feature/issue-<number>
```

## 1. Initial Implementation
- Read and understand the issue requirements
- Create a TODO list to track progress
- Implement the required changes
- Update tests to cover new functionality
- Run `npm test` to ensure all tests pass
- Check test coverage threshold (80% for statements, branches, functions, and lines)
- **Important:** Add sufficient tests to meet coverage thresholds
- Make the first commit with a descriptive message

## 2. Verify the Feature
- Start the development server: `npx --yes serve -l 8000`
- **Use browser testing mode to verify the feature works correctly**
- Test all new functionality thoroughly
- Test related functionality to ensure no regressions

## 3. Review and Improve
- Review the implementation for potential improvements
- Add additional test coverage for edge cases
- Ensure test coverage threshold is met (run `npm test` to verify)
- Make a second commit with improvements if needed

## 4. Create PR and Push
- Inform the developer that the server is running and wait for their confirmation
- Once confirmed, proceed with creating the PR:
```bash
git checkout feature/issue-<number>  # if not already
git add .
git commit -m "Feature: Description" -m "Details..." -m "Fixes #<number>"
git push -u origin feature/issue-<number>
```
- Provide the PR creation link to the developer
- Reference the issue number in the PR description and commit message

## 5. Documentation
- Update `AGENTS.md` or relevant documentation if the process changes
- Ensure all changes are properly documented

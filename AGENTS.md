# AGENTS.md

General guidelines for AI agents working in this repository.

## Workflow

- Always create a feature branch before making changes. Never commit directly to `main`.
- Follow a test-driven approach: write tests before or alongside implementation.
- Run tests and linting before committing.
- Keep commits small and focused. One logical change per commit.

## Code Quality

- All code must pass the SonarQube quality gate.
- Maintain ≥ 80 % test coverage (statements, branches, functions, lines).
- Prefer explicit, readable code over clever one-liners.

## Communication

- Open pull requests with a clear title and description explaining the *why*, not just the *what*.
- Link the relevant GitHub issue in the pull request description.
- Flag breaking changes explicitly in the PR description.

## Security

- Never commit secrets, tokens, or credentials.
- Never log sensitive user data.
- When in doubt about a security decision, make the conservative choice and note it in the PR.
- **GitHub repository secrets** contains `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GOOGLE_API_KEY`, `GOOGLE_CLIENT_ID`, `SONAR_TOKEN`
- **Google Cloud Secret Manager** contains `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## General Principles

- When something is unclear, ask rather than assume.
- Prefer reversible changes over irreversible ones.
- Delete code that is no longer needed. Dead code is a liability.

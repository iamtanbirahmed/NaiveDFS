---
name: Git and Commit Conventions
description: The required conventions for git branching, commit messages, and Pull Request creation for the project.
---

# Git Workflow and Commit Conventions

This skill defines the strict rules that must be followed when managing version control for this repository. Please adhere to these guidelines during all development tasks.

## 1. Commit Message Convention

Always use Conventional Commits with specific scopes whenever possible. Your commit message should follow this pattern:
`type(scope): message`

**Examples:**

- `feat(ui): add new telemetry dashboard`
- `fix(cd): update deployment scripts`
- `chore(backend): bump maven dependencies`
- `docs(readme): add setup instructions`

## 2. Branching Rules

- **Creating new branches:** Always create a new branch from the repository's default branch (`main` or `master`).
- **Confirmation:** You MUST ask for confirmation before creating a new branch.
- **Default usage:** If the user does not specify a branch name or new branch workflow, commit the changes directly to the current active branch.
- **Main Branch Commits:** You MUST ALWAYS ask for explicit confirmation before committing directly to the `main` or `master` branch.

## 3. Pre-Commit Workflow

- **Rebasing:** Always rebase the current branch against the remote target branch before committing your changes. This ensures a clean, linear git history.

## 4. Pull Request Workflow

- **Confirmation:** You MUST present the changes and ask the user for a review and explicit confirmation before creating a Pull Request. Do not auto-create PRs without consent.

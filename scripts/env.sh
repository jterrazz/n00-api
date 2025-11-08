#!/usr/bin/env sh

# Always point to the project-local SQLite DB using an absolute path
# Works whether this file is sourced or executed, and in any shell (bash/zsh/sh)
if command -v git >/dev/null 2>&1; then
  ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
else
  ROOT_DIR="$(pwd)"
fi

export DATABASE_URL="file:${ROOT_DIR}/database/main.sqlite"
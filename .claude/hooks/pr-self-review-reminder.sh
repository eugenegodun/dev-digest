#!/usr/bin/env bash
# PreToolUse hook: when a Bash command actually opens a PR or pushes a branch,
# inject a non-blocking reminder so Claude runs the `pr-self-review` skill first.
# Advisory by design — never blocks the command (always exits 0).

input="$(cat)"

# Pull out the real command text (not the whole JSON payload) so a commit message
# or prose that merely mentions "git push" / "gh pr create" does NOT trigger us.
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)"
else
  cmd="$input"
fi

# Match only when `git push` / `gh pr create` begins a statement — at the start of
# the command or right after a shell separator (; & | ( newline) — not mid-string.
if printf '%s' "$cmd" \
   | grep -Eq '(^|[;&|(]|[[:space:]]&&[[:space:]]|[[:space:]]\|\|[[:space:]])[[:space:]]*(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+create)'; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "Reminder: you're about to open a PR or push. Run the `pr-self-review` skill on the branch diff FIRST. If it returns REJECTED (>=1 critical), surface the blockers and recommend fixing before proceeding. This is advisory — do not block the command on the user's behalf."
  }
}
JSON
fi

exit 0

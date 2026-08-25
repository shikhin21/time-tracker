#!/bin/bash
# setup.sh — one-shot dev setup for Time Tracker (macOS).
# Checks prerequisites, asks before installing anything missing, then builds
# and launches the app in dev mode.
set -euo pipefail

cd "$(dirname "$0")"

bold="$(tput bold 2>/dev/null || true)"
reset="$(tput sgr0 2>/dev/null || true)"

say()  { printf '%s\n' "$*"; }
step() { printf '\n%s==> %s%s\n' "$bold" "$*" "$reset"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

confirm() {
  local ans
  read -r -p "$1 [y/N] " ans
  [[ "$ans" == [Yy]* ]]
}

cat <<'EOF'
Time Tracker — dev setup
========================
This script takes a fresh machine from clone to a running app. It will:

  1. Check the prerequisites: Xcode Command Line Tools, Rust (rustup),
     and Node.js 20.19+ / 22.12+.
  2. Ask your permission before downloading or installing anything missing.
  3. Install the npm dependencies.
  4. Build and launch the app in dev mode (npm run tauri dev).

Nothing is installed without asking first. Ctrl-C at any point to stop.
EOF

[[ "$(uname -s)" == Darwin ]] || fail "this app targets macOS; setup.sh only supports macOS."

step "Xcode Command Line Tools"
if xcode-select -p >/dev/null 2>&1; then
  say "found: $(xcode-select -p)"
else
  say "The Xcode Command Line Tools are missing (needed to compile the Tauri Rust core)."
  confirm "Run 'xcode-select --install' now?" \
    || fail "cannot continue without them — install and rerun ./setup.sh"
  xcode-select --install
  say "A macOS installer window has opened. Complete it, then come back here."
  read -r -p "Press Enter once that installation has finished... " _
  xcode-select -p >/dev/null 2>&1 \
    || fail "still not found — rerun ./setup.sh once the installation completes."
fi

step "Rust toolchain"
if ! command -v rustc >/dev/null 2>&1 && [ -x "$HOME/.cargo/bin/rustc" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
  say "note: rustc wasn't on PATH but exists in ~/.cargo/bin — added it for this run."
fi
if command -v rustc >/dev/null 2>&1; then
  say "found: $(rustc --version)"
else
  say "Rust is missing (the Tauri core is written in Rust)."
  confirm "Install it via rustup (https://rustup.rs)?" \
    || fail "cannot continue without Rust — install it and rerun ./setup.sh"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  . "$HOME/.cargo/env"
  say "installed: $(rustc --version)"
fi

step "Node.js"
node_ok() {
  local v major minor
  v="$(node --version 2>/dev/null)" || return 1
  v="${v#v}"
  major="${v%%.*}"
  minor="${v#*.}"; minor="${minor%%.*}"
  (( major >= 23 )) && return 0
  (( major == 22 && minor >= 12 )) && return 0
  (( major == 20 && minor >= 19 )) && return 0
  return 1
}
if node_ok; then
  say "found: node $(node --version)"
else
  if command -v node >/dev/null 2>&1; then
    say "node $(node --version) is too old — Vite 7 needs 20.19+ or 22.12+."
  else
    say "Node.js is missing — Vite 7 needs 20.19+ or 22.12+."
  fi
  command -v brew >/dev/null 2>&1 \
    || fail "install Node 20.19+/22.12+ (nodejs.org, nvm, or Homebrew) and rerun ./setup.sh"
  confirm "Install the current Node.js with Homebrew (brew install node)?" \
    || fail "install Node 20.19+/22.12+ and rerun ./setup.sh"
  brew install node
  node_ok || fail "the node now on PATH still doesn't satisfy the requirement — check 'node --version' and rerun ./setup.sh"
  say "installed: node $(node --version)"
fi

step "npm dependencies"
if [ -d node_modules ]; then
  say "node_modules already present — skipping npm install (run 'npm install' yourself to refresh)."
else
  confirm "Download and install the npm dependencies (npm install)?" \
    || fail "cannot continue without them — run 'npm install' and rerun ./setup.sh"
  npm install
fi

step "Build and run"
say "Ready to launch the app in dev mode (npm run tauri dev)."
say "The first run compiles the full Rust dependency tree and can take a few minutes."
if confirm "Launch now?"; then
  exec npm run tauri dev
fi
say "Setup complete. Launch any time with: npm run tauri dev"

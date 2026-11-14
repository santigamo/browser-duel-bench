#!/bin/sh
# Point .bin/agent-browser at the agent-browser binary you built (the tracked absolute symlink was removed).
# usage: scripts/setup.sh /path/to/agent-browser/cli/target/release/agent-browser
set -eu
HERE=$(cd "$(dirname "$0")/.." && pwd)
[ $# -eq 1 ] && [ -x "$1" ] || { echo "usage: $0 <path to an agent-browser binary>" >&2; exit 2; }
mkdir -p "$HERE/.bin"
ln -sfn "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")" "$HERE/.bin/agent-browser"
echo "linked $HERE/.bin/agent-browser"

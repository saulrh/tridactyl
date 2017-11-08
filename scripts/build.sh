#!/bin/sh

set -e

PATH=$(npm bin):"$PATH"
export PATH

mkdir -p generated/static
scripts/excmds_macros.py
scripts/make_docs.sh &
scripts/newtab.md.sh
nearleyc src/grammars/bracketexpr.ne > src/grammars/bracketexpr.ts

(webpack --display errors-only && scripts/git_version.sh)&

wait

#!/bin/sh
# firebase-tools emulators require Java 21+. Pick it up without touching the global JAVA_HOME.
set -e
if ! java -version 2>&1 | grep -qE 'version "(2[1-9]|[3-9][0-9])'; then
  for c in "$JAVA_HOME_21" "$HOME/homebrew/opt/openjdk@21" /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 "$(/usr/libexec/java_home -v 21 2>/dev/null || true)"; do
    if [ -n "$c" ] && [ -x "$c/bin/java" ]; then export JAVA_HOME="$c"; export PATH="$c/bin:$PATH"; break; fi
  done
fi
exec firebase emulators:exec --project demo-palestra "$@"

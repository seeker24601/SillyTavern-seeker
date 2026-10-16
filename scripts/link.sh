#!/bin/zsh
# Links this project into a local SillyTavern for live editing, and installs
# the matching UI theme. Edit style.css, then reload the SillyTavern tab.
#
#   scripts/link.sh [path-to-SillyTavern]   (default: ~/SillyTavern)
set -euo pipefail
ROOT="${0:A:h:h}"
ST="${1:-$HOME/SillyTavern}"
USER_DIR="$ST/data/default-user"
[[ -d "$USER_DIR" ]] || { print "No SillyTavern user folder at $USER_DIR"; exit 1; }

mkdir -p "$USER_DIR/extensions" "$USER_DIR/themes"
LINK="$USER_DIR/extensions/SillyTavern-seeker"
if [[ -e "$LINK" && ! -L "$LINK" ]]; then
  print "$LINK exists and is not a link; remove it first."; exit 1
fi
ln -sfn "$ROOT" "$LINK"
cp "$ROOT/theme/seeker.json" "$USER_DIR/themes/seeker.json"
cp "$ROOT/theme/seeker-gilt.json" "$USER_DIR/themes/seeker gilt.json"
print "Linked $LINK -> $ROOT"
print "Installed themes: seeker, seeker gilt"
print "Reload SillyTavern, enable seeker under Extensions if needed, and pick seeker (or seeker gilt, with a gold accent) in User Settings."

#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$REPO_DIR/public"

copy_public_to() {
  local target_dir="$1"
  if [ -z "$target_dir" ]; then
    return
  fi

  /bin/mkdir -p "$target_dir"
  /bin/cp -R "$SOURCE_DIR"/. "$target_dir"/
  echo "Deployed public/ to $target_dir"
}

copy_public_to "$HOME/public_html/eduard-si-lorena"
copy_public_to "$HOME/public_html/eduard-si-lorena.aerdigital.ro"
copy_public_to "$HOME/eduard-si-lorena"
copy_public_to "$HOME/eduard-si-lorena.aerdigital.ro"

if [ -d "$HOME/public_html" ]; then
  while IFS= read -r candidate; do
    target_dir="$(/usr/bin/dirname "$candidate")"

    case "$target_dir" in
      "$REPO_DIR"*)
        continue
        ;;
    esac

    if /bin/grep -Iq "Lagoo Snagov" "$candidate"; then
      copy_public_to "$target_dir"
      break
    fi
  done < <(/usr/bin/find "$HOME/public_html" -maxdepth 4 -type f -name index.html -print 2>/dev/null)
fi

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
  while IFS= read -r index_file; do
    target_dir="$(/usr/bin/dirname "$index_file")"

    case "$target_dir" in
      "$REPO_DIR"*)
        continue
        ;;
    esac

    copy_public_to "$target_dir"
  done < <(
    /usr/bin/find "$HOME/public_html" -maxdepth 5 -type f -name index.html -print 2>/dev/null |
      while IFS= read -r candidate; do
        if /bin/grep -Iq "Lagoo Snagov" "$candidate"; then
          echo "$candidate"
        fi
      done
  )
fi

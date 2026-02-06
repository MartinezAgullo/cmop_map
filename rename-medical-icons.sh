#!/bin/bash
# rename-medical-icons.sh
# Renames medical_role_*.svg → medevac_role_*.svg in friendly/ and hostile/ directories
# This fixes the naming conflict between medical_facility and medevac_unit categories

set -e

ICONS_DIR="/Users/pablo/Desktop/Scripts/cmop_map/public/icons"

echo "🔄 Renaming medical_role_*.svg → medevac_role_*.svg..."

# Friendly
cd "$ICONS_DIR/friendly"
for file in medical_role_*.svg; do
  if [ -f "$file" ]; then
    newname="${file/medical_role_/medevac_role_}"
    mv "$file" "$newname"
    echo "  ✅ $file → $newname"
  fi
done

# Hostile
cd "$ICONS_DIR/hostile"
for file in medical_role_*.svg; do
  if [ -f "$file" ]; then
    newname="${file/medical_role_/medevac_role_}"
    mv "$file" "$newname"
    echo "  ✅ $file → $newname"
  fi
done

echo "✅ Done. All medical_role_*.svg → medevac_role_*.svg"
echo ""
echo "Now update app.js to use correct icon names:"
echo "  - medical_facility → medical_facility_role_X"
echo "  - medevac_unit → medevac_role_X"

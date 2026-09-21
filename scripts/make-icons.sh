#!/bin/sh
# Regenerates public/icon/*.png (needs ImageMagick). Colors match src/ui/styles.ts tokens:
# --b2t-bg #120f0c, --b2t-accent #dcaf61, --b2t-accent-dim #6a5124.
set -e
mkdir -p public/icon
magick -size 512x512 xc:none \
  -fill '#120f0c' -stroke '#6a5124' -strokewidth 16 -draw 'roundrectangle 16,16 496,496 96,96' \
  -fill none -stroke '#dcaf61' -strokewidth 44 -draw 'circle 220,220 220,370' \
  -strokewidth 56 -draw 'stroke-linecap round line 330,330 420,420' \
  /tmp/b2t-icon-512.png
for size in 16 32 48 128; do
  magick /tmp/b2t-icon-512.png -resize ${size}x${size} "public/icon/${size}.png"
done
rm /tmp/b2t-icon-512.png

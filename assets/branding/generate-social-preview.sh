#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
logo="$project_root/public/icon-512x512.png"
output="$project_root/public/social-preview.png"
sans='/System/Library/Fonts/Supplemental/Arial.ttf'
sans_bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
mono='/System/Library/Fonts/SFNSMono.ttf'

magick -size 1200x630 gradient:'#17151d-#211b38' \
	-fill '#6542c72e' -draw 'circle 1100,-40 1410,-40' \
	-fill '#7551db1a' -draw 'circle 80,660 330,660' \
	-fill '#f7f5fb' -font "$sans_bold" -pointsize 60 -draw "text 88,264 'Markdown Toolkit'" \
	-fill '#c6bfda' -font "$sans_bold" -pointsize 30 -draw "text 88,318 'Private Markdown editor'" \
	-fill '#514a60' -draw 'rectangle 88,364 516,365' \
	-fill '#9991aa' -font "$sans" -pointsize 20 \
	-draw "text 88,412 'Write  ·  Preview  ·  Mermaid  ·  Export'" \
	-fill '#1d1b21' -stroke '#514a60' -strokewidth 2 -draw 'roundrectangle 614,92 1104,538 18,18' \
	-stroke none -fill '#25222a' -draw 'rectangle 616,94 1102,134' \
	-fill '#756b84' -draw 'circle 640,113 644,113 circle 656,113 660,113 circle 672,113 676,113' \
	-fill '#17161a' -draw 'rectangle 616,134 858,536' \
	-fill '#201e24' -draw 'rectangle 859,134 1102,536' \
	-fill '#4a4552' -draw 'rectangle 858,134 859,536' \
	-fill '#df8790' -font "$mono" -pointsize 19 -draw "text 644,183 '# Project notes'" \
	-fill '#82798c' -draw 'roundrectangle 644,211 818,218 3,3' \
	-fill '#625b6b' -draw 'roundrectangle 644,231 788,238 3,3' \
	-fill '#c6bfda' -font "$mono" -pointsize 16 \
	-draw "text 644,278 '- Draft ideas' text 644,307 '- Review notes'" \
	-fill '#df8790' -font "$mono" -pointsize 17 -draw "text 644,358 '## Diagram'" \
	-fill '#625b6b' -draw 'roundrectangle 644,382 808,389 3,3 roundrectangle 644,402 762,409 3,3' \
	-fill '#f1eef5' -font "$sans_bold" -pointsize 27 -draw "text 889,188 'Project notes'" \
	-fill '#81798a' -draw 'roundrectangle 889,215 1069,222 3,3' \
	-fill '#625b6b' -draw 'roundrectangle 889,235 1034,242 3,3' \
	-fill '#c6bfda' -draw 'circle 897,280 900,280 circle 897,306 900,306' \
	-fill '#8e8699' -draw 'roundrectangle 909,276 1023,283 3,3 roundrectangle 909,302 1041,309 3,3' \
	-fill '#17161a' -stroke '#4a4552' -strokewidth 1 -draw 'roundrectangle 889,353 1043,449 5,5' \
	-stroke none -fill '#6542c7' -draw 'roundrectangle 914,378 956,400 3,3 roundrectangle 976,402 1018,424 3,3' \
	-stroke '#b8aec9' -strokewidth 2 -fill none \
	-draw 'line 956,389 976,389 line 976,389 976,413' \
	\( "$logo" -resize 116x116 \) -geometry +88+88 -composite -depth 8 -strip \
	-define png:compression-level=9 "$output"

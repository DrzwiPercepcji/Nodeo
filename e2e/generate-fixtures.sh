#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/fixtures" 2>/dev/null || mkdir -p "$(dirname "$0")/fixtures" && cd "$(dirname "$0")/fixtures" && pwd)"

gen() {
  local out="$DIR/$1"; shift
  [ -f "$out" ] && return 0
  ffmpeg -y "$@" "$out" 2>/dev/null
}

# Basic samples (no metadata)
gen sample.mp3 \
  -f lavfi -i "sine=frequency=440:duration=1" \
  -c:a libmp3lame -b:a 128k

gen sample.mp4 \
  -f lavfi -i "testsrc=duration=1:size=320x240:rate=25" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart

# Tagged audio for cover art tests
gen nirvana-teen-spirit.mp3 \
  -f lavfi -i "anullsrc=r=44100:cl=mono" -t 1 \
  -c:a libmp3lame -b:a 32k \
  -metadata artist="Nirvana" \
  -metadata album="Nevermind" \
  -metadata title="Smells Like Teen Spirit"

gen metallica-nothing-else.mp3 \
  -f lavfi -i "anullsrc=r=44100:cl=mono" -t 1 \
  -c:a libmp3lame -b:a 32k \
  -metadata artist="Metallica" \
  -metadata album="Metallica" \
  -metadata title="Nothing Else Matters"

gen sabbath-heaven-hell.mp3 \
  -f lavfi -i "anullsrc=r=44100:cl=mono" -t 1 \
  -c:a libmp3lame -b:a 32k \
  -metadata artist="Black Sabbath" \
  -metadata album="Heaven and Hell" \
  -metadata title="Heaven and Hell"

echo "Fixtures ready in $DIR"

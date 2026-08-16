#!/bin/bash
cd $(dirname $0)

apt list --installed 2>/dev/null | grep pngquant >/dev/null
[[ $? -ne 0 ]] && sudo apt-get install pngquant -y

UNCOMPRESSED_FILES=`find . -name *.png | grep -E -v "^./(docs|node_modules)"`
echo "compless... $UNCOMPRESSED_FILES"
pngquant --ext .png --skip-if-larger --force $UNCOMPRESSED_FILES

echo "Complete!"
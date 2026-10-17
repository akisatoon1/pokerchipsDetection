#!/usr/bin/env bash

# 複数色のスタック画像すべてに対して, 検出プログラムを実行して表示する.
# デバッグのため.

for file in testimages/yoko/stack/multicolor_jpg/*.jpg; do
    make run ARGS="$file"
done

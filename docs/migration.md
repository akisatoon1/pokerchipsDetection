# 開発環境の移行 (WSL → Ubuntu の実機)

開発環境を, 今の WSL2 (Windows 上の Ubuntu 24.04) から別の Ubuntu の実機に移すための作業.
移行先のセットアップ自体は新規のセットアップと同じなので [setup.md](setup.md) に書いてある.
ここには **移行のときだけ必要な作業** (移行元での準備, 持っていくもの, 移行後の確認) を書く.

## 移行する理由

今の WSL 環境では Android アプリの開発を進めにくい.

- sudo が使えない (パスワードが必要) ため, GTK の開発パッケージを入れられない.
  OpenCV が GUI なしでビルドされており, `imshow` や手動の ROI 選択が使えない.
- Android SDK がなく, アプリ (Kotlin 側) のビルドを確かめられていない.
- Windows 側の Android Studio で WSL 上のプロジェクトを開くと, Gradle が遅いうえに,
  NDK のビルド (CMake / ninja) が `\\wsl.localhost\...` のような UNC パスで失敗しやすい.
  避けるには Windows 側にもう1つクローンを置いて git で同期する必要があり, 手間が増える.

Ubuntu の実機なら, Linux 版 (CLI・テスト) と Android 版を **同じマシン・同じリポジトリで** ビルドでき,
エミュレータも KVM で速く動く. Claude Code もそのマシンで動かせば, Gradle のビルドや
`adb` での確認まで Claude Code が直接行える.

## 全体の流れ

1. 移行元 (今の WSL) で準備する
2. 移行先のマシンを確認する
3. 移行先をセットアップする ([setup.md](setup.md))
4. 移行先で確認する
5. 後片付け

## 1. 移行元でやること

- [☑] **作業中の変更をすべてコミットして push する.**
  移行先へは git (GitHub の `akisatoon1/pokerchipsDetection`) で持っていく.
  push 前に `git status` で取りこぼしがないことを確認する.
- [x] **`pyscript/requirements.txt` のバージョンを固定する.** (2026-10-16 に対応済み)
  ultralytics のバージョンが変わると ONNX の書き出し方が変わり,
  検出器のテストの基準と合わなくなる恐れがあるため. 固定したのは移行元で動いている組み合わせ:

  | パッケージ | バージョン |
  |---|---|
  | ultralytics | 8.4.150 |
  | torch | 2.14.0 |
  | torchvision | 0.29.0 |
  | onnx | 1.23.2 |
  | onnxslim | 0.1.98 |
  | onnxruntime | 1.31.0 |
  | numpy | 2.5.3 |
  | opencv-python | 5.0.0.93 |

  (Python は 3.12.3. 固定したのは上の直接の依存と結果に影響しうるものだけで, それ以外の依存は固定していない)
- [ ] **`best.pt` (重みファイル) を移行先へ送る.** git 管理外で, 移行元から持っていくのはこれだけ.
  ```
  scp best.pt <移行先>:~/
  ```

### 持っていくもの / 持っていかないもの

| ファイル | 扱い | 理由 |
|---|---|---|
| git 管理下のすべて (コード, docs, testimages, `tests/data/`) | git で持っていく | |
| `best.pt` | **scp で送る** | git 管理外. 移行先の `make model` で ONNX を作り直すのに使う |
| `models/` (ONNX) | 持っていかない | `best.pt` から `make model` で作り直す. 作り直した ONNX でテストが通ることも確認になる |
| `.venv/` (約 6GB) | 持っていかない | マシン固有. 移行先で作り直す |
| `third_party/` (約 4.5GB) | 持っていかない | マシン固有のビルド結果とダウンロード物. 移行先で `make opencv` / `make android-deps` |
| `build/`, `build-android/` | 持っていかない | ビルド結果 |
| Claude Code の設定 (`~/.claude/`) | 持っていかない | 移行先で設定し直す |

## 2. 移行先のマシンで確認すること

- [ ] Ubuntu 24.04 である (`lsb_release -ds`). 違う場合は clang-format / clang-tidy のバージョン差に注意
- [ ] sudo が使える
- [ ] メモリ 16GB 以上, ディスクの空き 40GB 以上
- [ ] エミュレータを使うなら `/dev/kvm` がある
- [ ] GitHub に SSH で接続できる (`ssh -T git@github.com`)

## 3. 移行先をセットアップする

[setup.md](setup.md) の手順をそのまま行う. 移行で特に気をつける点:

- clone 先は `~/workspace/pokerchip` にする (ドキュメントのパスと合わせるため).
- `libgtk-3-dev` は **`make opencv` より前に** 入れる. 今回の移行の目的の1つが GUI を使えるようにすることなので.
- `best.pt` はリポジトリのルートに置いてから `make model PT=best.pt`.

## 4. 移行先で確認すること

上から順に行う. 1〜4 は移行元でも通っていたものなので, 失敗したら環境の違いを疑う.
5 以降は移行元では確かめられていなかった項目.

- [ ] 1. `make test` が全件 (6 件) 通る
- [ ] 2. `make check` で指摘がない
- [ ] 3. testimages で CLI が動く. 結果は 7 で Android と比べるのに使うので保存しておく
  ```
  for f in testimages/yoko/stack/*/*.jpg testimages/yoko/single/*.jpg; do
    echo "$f $(./build/pokerchip --json --out /tmp/debug.png "$f" 2>&1 | grep -E '^\{|^Error')"
  done > ~/results.txt
  ```
  (1 行に「画像のパス + JSON かエラー」が並ぶ. 27 枚のうち, 移行元でスタックが検出されなかった
  5 枚は `Error: ROI was not selected.` になる)
- [x] 4. `make android-native` が通る (core + JNI の NDK ビルド)
- [ ] 5. GUI が使える: `./build/pokerchip --roi user testimages/yoko/stack/singlecolor/IMG_5587.jpg`
  で ROI を選ぶ画面が出て, 結果の画像が表示される
- [x] 6. `cd android && ./gradlew assembleDebug` が通る.
  (2026-10-17 に Android 16 以上向けに作り直してから通した. [worklog.md](worklog.md) を参照)
- [x] 7. エミュレータか実機でアプリが動き, testimages の画像で 3 と同じ枠・枚数・色が出る
  (手順は [setup.md](setup.md) の「Linux と同じ結果になるかの確認」)
- [ ] 8. 実機での解析時間を測る (参考: 移行元の Linux で CLI 全体が約 0.7 秒)

## 5. 後片付け

- [ ] [worklog.md](worklog.md) に移行の記録 (確認結果, 直したところ) を書く
- [ ] (任意) `scripts/check_android_native.sh` を, Android Studio が入れた NDK
  (`~/Android/Sdk/ndk/30.0.16248370`) も使えるようにする. 今は `third_party/` の NDK を
  使うので, NDK を2つダウンロードすることになっている
- [ ] 移行元の WSL 環境は, 移行先で 4 の確認が終わるまで消さずに残しておく.
  消す場合は `.venv/` と `third_party/` だけで約 10GB 空く

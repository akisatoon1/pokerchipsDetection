# 作業記録

大まかな記録. 設計の結論は [architecture.md](architecture.md), 環境構築の手順は
[setup.md](setup.md), Linux マシンでの使い方は [usage.md](usage.md) にまとめている.

## 2026-10-12: Android アプリ化の土台づくり

### 方針

- Linux と Android で検出ロジックを共有するため, ロジックを C++ の `core/` にまとめ,
  CLI (Linux) と JNI (Android) を薄い殻にする.
- YOLO の推論は OpenCV DNN で行う (Python の ultralytics を popen で呼ぶ方式は Android で使えない).
- アプリは静止画 (撮影 / ギャラリー), UI は Kotlin + Jetpack Compose.

### 1. OpenCV DNN で YOLO が動くかの確認 (最大のリスクを先に潰す)

`best.pt` は yolo26n ベースでクラスは `stack` のみ. ONNX に2通りで export した.

- end2end=True: 出力 `[1, 300, 6]`. モデル内に TopK を含む.
- end2end=False: 出力 `[1, 5, 8400]` (NMS 前).

| OpenCV | end2end | 生出力 |
|---|---|---|
| 4.6.0 (apt, C++) | 読込失敗: TopK 非対応 | 推論時に失敗 (`shape_utils.hpp` の assert) |
| 4.8.1 (pip) | 読込失敗: TopK 非対応 | OK |
| 4.10.0 (pip) | 読込失敗: TopK 非対応 | OK |
| 4.14.0 (pip) | OK | OK |
| 5.0.0 (pip) | OK | OK |

→ apt の 4.6 は使えない. Android SDK と Maven がある 4.x の最新 4.14.0 に Linux/Android とも揃える.
Linux はソースビルド (`scripts/build_opencv.sh`, 数分).

- sudo が使えない (パスワードが必要) ため GTK の開発パッケージを入れられず,
  今の Linux 版 OpenCV は **GUI なし** でビルドされている.
  `imshow` / `selectROI` は使えないので, CLI に `--out` (画像保存) と `--rect` (ROI の数値指定) を足した.
  `sudo apt install libgtk-3-dev` の後に `make opencv` をやり直せば GUI が使えるようになる.

### 2. ビルドを CMake 化し, core / cli に分割

- `src/{counting,color,visualize}.*` → `core/` (中身はほぼそのまま. インクルードを
  `opencv2/opencv.hpp` から `core.hpp` / `imgproc.hpp` に絞り, highgui に依存しないようにした).
- 新規: `core/src/detector.cpp` (YOLO), `core/src/pipeline.cpp` (検出 → 計数 → 色判定, JSON 化).
- `src/main.cpp`, `src/roi.cpp` → `cli/`. popen で Python を呼ぶ処理と `env.*` (環境変数) は削除.
  `env.sh` はもう使わない.
- `test/test_selectRoiWithYOLO.cpp` は削除し, GoogleTest の `tests/` に置き換え.
  (このテストが参照していた `testimages/yoko/stack/IMG_5587.jpg` は画像の移動で既に存在しなかった)
- Makefile は CMake のラッパーにした (`make build/test/run/tidy/format/check` など).

### 3. 検出器 (YoloDetector) の実装と検証

- 前処理は ultralytics の letterbox (640x640, 余白 114, 丸め方まで) に合わせた.
- `pyscript/make_yolo_reference.py` で ultralytics の検出結果を `tests/data/yolo_reference.txt` に書き出し,
  `tests/test_detector.cpp` で比べる.
- 最初は `best.pt` の結果を基準にしたが, IoU 0.93 程度のずれと検出数の違い (IMG_5584 で 2 → 1) が出た.
  ultralytics は `.pt` だと長方形 (余白最小) で, ONNX だと正方形で推論するのが原因.
  ultralytics + 同じ ONNX を基準にすると **全画像で一致** した (前処理・後処理の実装は正しい).
- end2end の ONNX が IMG_5591 で同じスタックを2つ返した (0.86 と 0.51).
  end2end 形式にも NMS (IoU 0.7) をかけるようにし, 基準の生成スクリプトにも同じ NMS を入れた.

### 4. リファクタ前後の比較

旧実装 (HEAD のコード + apt の OpenCV 4.6 + Python の YOLO) と新実装 (core + OpenCV 4.14 + C++ の YOLO) を
`testimages/yoko` の全 27 枚で比べた.

- YOLO で ROI を決めた場合: 4 枚で枚数が変わった.

  | 画像 | 旧 | 新 |
  |---|---|---|
  | multicolor_jpg/IMG_5721 | 3 | 10 |
  | multicolor_jpg/IMG_5723 | 5 | 3 |
  | multicolor_jpg/IMG_5732 | 50 | 49 |
  | singlecolor/IMG_5582 | 15 | 14 |

- 旧実装と同じ ROI を `--rect` で与えると, 22 枚すべてで枚数と色が完全に一致した.
  → リファクタと OpenCV の更新では計数・色判定は変わっていない. 差は ROI が数ピクセル
  ずれたこと (`.pt` と ONNX の前処理の違い) だけによる.
- **気づき: 計数は ROI のわずかなずれに弱い.** IMG_5721 は ROI が数ピクセル違うだけで 3 枚と 10 枚に分かれる.
  今後の改善点として architecture.md の「今後の課題」に記載した.
- 正解の枚数のデータがないので, どちらが正しいかはまだ判断していない.

### 5. Android

- `make android-deps` で OpenCV Android SDK 4.14.0 と NDK r27c を `third_party/` に取得.
- `android/app/src/main/cpp/CMakeLists.txt` で core を `add_subdirectory` し, JNI (`jni_bridge.cpp`) を足した.
  SDK の OpenCV は既定で静的ライブラリをリンクする.
- **NDK で arm64-v8a / x86_64 向けにビルド・リンクできることを確認した** (`make android-native`).
  Linux と同じ core のソースがそのまま Android 向けにビルドできる.
- Kotlin + Compose のアプリ (撮影 / ギャラリー → 解析 → 枠と枚数の表示, 色の内訳) を書いた.
- Gradle wrapper (8.11.1) を生成. AGP 8.7.3 / Kotlin 2.1.0 のプラグイン解決までは通るが,
  この環境には Android SDK がないため `SDK location not found` で止まる.
  **Kotlin 側のコンパイルと実機での動作は未確認.**
  SDK のライセンス同意が必要なため, SDK のインストールはこちらでは行っていない.

### 測定メモ

- Linux (WSL2, CPU) で CLI 全体 (画像読込 + 検出 + 計数 + 色判定 + デバッグ画像保存) が約 0.7 秒.
- Android 用の `libpokerchip_jni.so` は strip 前で arm64 が 34MB (Gradle が strip する).

### その他

- `.venv` に `onnx`, `onnxslim`, `onnxruntime` を追加 (ONNX の export と, ultralytics で ONNX を
  推論するため). `pyscript/requirements.txt` に追記した.

### 次にやること

- Android SDK を用意して `./gradlew assembleDebug` を通し, 実機かエミュレータで動かす.
  testimages と同じ画像を読み込ませ, Linux の `--json` と結果が一致するかを確かめる.
- 実機での推論時間を測る.
- testimages の正解の枚数・色を用意し, 計数の精度を回帰テストにする.
- 計数が ROI のずれに弱い問題の調査.

## 2026-10-15: 開発環境の移行の準備 (ドキュメントのみ)

- Android アプリのビルドは, Windows 側の Android Studio ではなく **Ubuntu の実機** で行うことにした.
  WSL では sudo が使えず (GUI なしの OpenCV), Windows の Android Studio から WSL 上のプロジェクトを
  開くと NDK ビルドが UNC パスで失敗しやすいため. 理由の詳細は [migration.md](migration.md).
- `docs/prerequisites.md` を `docs/setup.md` に改名し, 新しいマシンでゼロから使えるまでの手順に書き直した
  (apt, OpenCV, Python, モデル, Android Studio, 実機・エミュレータ, トラブルシューティング).
- 移行のときだけ必要な作業 (移行元での準備, 持っていくもの, 移行後の確認項目) を `docs/migration.md` に書いた.
- ドキュメントに書いたコマンドのうち, 結果を保存するループは移行元で実際に動かして確認した.
  当初 `tail -1` で JSON を取ろうとしていたが, 最後の行は「Saved debug view」なので `grep` に直した.
- 前回の記録で「testimages/yoko の全 31 枚」と書いていたのは誤りで, 27 枚 (stack 24 + single 3) だった. 訂正した.

## 2026-10-15: git で管理する内容の整理とコミット

- `.gitignore` を整理した. 項目ごとにコメントを付け, Android Studio / Kotlin が作る
  `android/.kotlin/`, `android/captures/`, `.idea/`, `*.iml` を足した. 使わなくなった `env.sh` の行は消した.
- `pyscript/getroi.py` (旧方式で C++ から popen で呼んでいたスクリプト) を削除した.
  ultralytics との比較は `pyscript/make_yolo_reference.py` が担う.
- `env.sh` (旧方式の環境変数の設定. git 管理外) を削除した.
- コミット前に, 公開して問題がないかを確認した.
  - 画像 (追跡中の 31 枚と, 履歴にある HEIC 13 枚): EXIF に位置情報 (GPS) はない.
    機種 (iPhone 13) と撮影日時は残っている. 写っているのはチップと机, ぼけた本棚だけ.
  - テキスト: 秘密情報 (パスワード, トークン, 鍵) やローカルの絶対パスはない.
    `docs/migration.md` にあったローカルのユーザー名入りのパスは一般的な書き方に直した.
  - `android/gradle/wrapper/gradle-wrapper.jar` は Gradle 公式の sha256 と一致した.
  - コミットの作者のメールアドレスは, push 済みのコミットと同じもの.
- 未対応のまま残したもの: 履歴の HEIC (約 30MB) の扱い, 検出結果の基準とモデルの対応の記録.

## 2026-10-16: Python パッケージのバージョン固定

- `pyscript/requirements.txt` のバージョンを固定した ([migration.md](migration.md) の「移行元でやること」の項目).
  移行元の `.venv` で動いている組み合わせ (ultralytics 8.4.150, torch 2.14.0, torchvision 0.29.0,
  onnx 1.23.2, onnxslim 0.1.98, onnxruntime 1.31.0, numpy 2.5.3) にした.
- 一覧になかった `opencv-python` (5.0.0.93) も固定した. ultralytics の前処理 (letterbox など) が使うため,
  `make_yolo_reference.py` の参照結果に影響しうる.
- それ以外の推移的な依存は固定していない. 完全に再現したくなったら `pip freeze` の結果を別ファイルに残す.
- `pip install --dry-run -r pyscript/requirements.txt` で, 今の `.venv` から何も変わらないことを確認した.

## 2026-10-16: 移行の手順の見直し

- 移行元から持っていくのは `best.pt` だけにした. [migration.md](migration.md) から,
  移行元での結果 (`results.txt`) の保存と送付, Claude Code の設定の送付の項目を消した.
- そのため移行後の確認の 3 は「移行元と結果が一致する」から「testimages で CLI が動く」に変えた.
  ここで保存した結果は, 7 で Android の結果と比べるのに使う.

## 2026-10-16: Linux マシンでの使い方のドキュメント

- `docs/usage.md` を作った. 環境構築の後の Linux マシンでの使い方 (ビルド, CLI の実行, 出力の見方,
  デバッグ画像, testimages をまとめて解析する方法, テスト, モデルを更新したとき, 整形と検査, make のターゲット) を書いた.
  環境構築は [setup.md](setup.md) を参照する形にした.
- `docs/setup.md` にあった「モデルを更新したとき」「CLI の使い方」「make のターゲット一覧」は usage.md に移した.
- 書いたコマンド (`--json --out`, `--rect`, `ctest -R`) は実際に動かして, 出力の例と合っていることを確認した.
  `--roi user` は GUI なしの OpenCV のため確認できていない (キー操作は OpenCV の `selectROI` の説明に従った).

## 2026-10-17: Android アプリを Android 16 以上向けに作り直す

まだ一度もビルドしていなかったので, 古い Android との互換は捨てて作り直した.

- minSdk 36 (Android 16), compileSdk / targetSdk 37 (Android 17). このマシンの SDK とエミュレータが API 37 のため.
- ツールチェーンを最新の安定版にした: Gradle 9.8.1, AGP 9.4.1 (Kotlin 内蔵なので `org.jetbrains.kotlin.android` は外した),
  Compose BOM 2026.09.00, NDK r30 (`30.0.16248370`), CMake 3.31.6. 版は `android/gradle/libs.versions.toml` にまとめた.
- NDK r28 以降は 16KB ページ整列が既定. `libpokerchip_jni.so` の LOAD の Align が 0x4000 になっていることを確認した.
  `scripts/fetch_android_deps.sh`, `scripts/check_android_native.sh` も r30 / android-36 に揃えた.
- Kotlin:
  - 画像の読み込みを `ImageDecoder` にした. EXIF の向きを自動で反映するので `ExifInterface` と回転処理を消した.
    JNI で画素を読むため `ALLOCATOR_SOFTWARE` にし, ARGB_8888 以外 (HDR など) は変換する.
  - `MainViewModel` の状態を `StateFlow` にし, 画面側は `collectAsStateWithLifecycle` で読む.
  - `enableEdgeToEdge()` と Material You の色 (`dynamicLightColorScheme` など) を使う. 画面は `ui/` に分けた.
  - JNI の名前 (`PokerChipNative`) と C++ 側は変えていない.
- 確認: `make android-native`, `./gradlew assembleDebug` と `lintDebug` が通る (lint はアイコン未設定の警告 1 件のみ).
  API 37 のエミュレータで `testimages/upper.jpg` をギャラリーから選び, CLI と同じ枠・枚数 (15, 3, 31)・色になった.
  撮影 (カメラアプリ経由) はまだ確かめていない.
- コミットは「ツールチェーンの更新」「画像の読み込みを ImageDecoder に」「状態と画面の作り直し」「ドキュメント」に分けた.
  途中のコミットでもビルドが通るように, 最初のコミットでは ExifInterface の依存を残し, 次のコミットで外した
  (各コミットで `:app:compileDebugKotlin` が通ることを確認した).
- このマシンには git の user.name / user.email が設定されていないため, 今回のコミットは `git -c` で
  過去のコミットと同じ作者 (akisatoon) を指定した.

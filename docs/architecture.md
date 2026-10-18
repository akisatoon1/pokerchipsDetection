# アーキテクチャ設計

ポーカーチップの山 (スタック) を撮影した写真から, チップの枚数と各チップの色を求める.
Linux で実験・テストし, 同じロジックを Android アプリで動かす.

## 目的と制約

- **ロジックは1つ**: Linux (実験・テスト) と Android (アプリ) で, 検出・計数・色判定のコードを共有する.
  Linux で調整したパラメータがそのままアプリに反映される状態にする.
- **YOLO と OpenCV を両環境で使う**: YOLO はスタック領域 (ROI) の検出, OpenCV は計数・色判定.
- **YOLO のモデルは別リポジトリで管理**: このリポジトリは学習済みモデル (ONNX) を受け取って使うだけ.
- **最初のアプリは静止画のみ**: 撮影 or ギャラリーから1枚選んで解析する. リアルタイム解析は後回し.

## 全体構成

```
pokerchip/
├── CMakeLists.txt          # Linux ビルドの入口 (core + cli + tests)
├── core/                   # ★共通ロジック. Linux/Android で同一ソース
│   ├── include/pokerchip/  # 公開ヘッダ
│   │   ├── pipeline.hpp    # analyzeImage: 画像 → 検出 → 計数 → 色判定
│   │   ├── detector.hpp    # YoloDetector: cv::dnn で ONNX を推論
│   │   ├── counting.hpp    # 輝度プロファイル法による枚数カウント
│   │   ├── color.hpp       # 白い縞で照明を補正し, Lab の基準色で色判定
│   │   └── visualize.hpp   # デバッグ用の可視化画像の生成
│   └── src/
├── cli/                    # Linux 専用の殻 (引数, 画像読込, 画面表示, 手動ROI選択)
├── tests/                  # GoogleTest (testimages を使う)
├── android/                # Android アプリ (Kotlin + Jetpack Compose + JNI)
│   └── app/src/main/cpp/   # JNI の殻. core を add_subdirectory してビルド
├── models/                 # ONNX モデル置き場 (git 管理外)
├── pyscript/               # Python 側の補助 (ultralytics での推論・比較, 色の基準色の計算)
├── scripts/                # 環境構築・モデル取得のスクリプト
└── third_party/            # ソースビルドした OpenCV (git 管理外)
```

### 依存の向き

```
 cli (Linux)  ─┐
               ├─▶ core ─▶ OpenCV (core, imgproc, dnn)
 android JNI ──┘
```

- **core は OpenCV の `core` / `imgproc` / `dnn` だけに依存する.**
  `highgui` (imshow, selectROI), `imgcodecs` (imread), `popen`, 環境変数, ファイルパスは core に持ち込まない.
  - 入力は `cv::Mat` (BGR). 画像の読み込みは殻 (CLI なら imread, Android なら Bitmap) の仕事.
  - モデルはファイルパスでもメモリ上のバイト列でも渡せるようにする.
    Android の assets はファイルパスを持たないため, バイト列で渡す.
- **cli と android は薄い殻に徹する.** ロジックを殻側に書くと両環境で挙動がずれるため.

## 処理の流れ

```
画像 (BGR)
  │
  ▼
YoloDetector::detect      … スタックの矩形を検出 (複数可). letterbox → 推論 → NMS
  │   各矩形を外側に丸め, 画像範囲にクランプ
  ▼
countChips(roi)           … 縦方向の輝度変化を1次元信号にし, 合わせ目の周期とピークから枚数を求める
  │
  ▼
classifyChipColors(roi)   … 白い縞で照明を補正し, ピーク間の区間ごとに Lab の基準色で色を判定
  │
  ▼
AnalysisResult { stacks: [ { box, score, count, colors } ... ] }   … 左のスタックから順
```

- `analyzeImage(detector, bgr)` が上の流れ全体. CLI と JNI はこれを呼ぶ.
- 手動で ROI を選ぶ場合 (Linux の実験用) は `analyzeRegion(bgr, rect)` で検出をスキップする.
- `toJson(result)` で JSON にする. Android への受け渡しと, 環境間の結果比較に使う.

## 設計判断と理由

### 1. 共通ロジックは C++ で書き, Android からは JNI で呼ぶ

- 既存のロジック (計数・色判定) が C++ + OpenCV で書かれており, そのまま使える.
- Android NDK は C++17 と CMake をサポートしており, Linux と同じソースをビルドできる.
- Kotlin で書き直すと2重実装になり, Linux での実験結果がアプリに反映されなくなる.

### 2. YOLO の推論は OpenCV DNN (`cv::dnn`) で行う

- 依存ライブラリが OpenCV だけで済む. ONNX Runtime や TFLite を足すと,
  Linux/Android それぞれでライブラリの入手・バージョン管理が必要になる.
- 推論の前処理 (`blobFromImage`) と後処理 (`NMSBoxes`) も OpenCV にある.
- 静止画1枚の解析なので, 専用ランタイムほどの速度は不要.
- バックエンドは `DNN_BACKEND_OPENCV` + `DNN_TARGET_CPU` に固定し, 両環境で同じ計算経路にする.

従来の「C++ から `popen` で Python (ultralytics) を呼ぶ」方式は Android で使えないため廃止する.
ultralytics との比較は `pyscript/make_yolo_reference.py` で行う (5 を参照). 旧方式で使っていた `pyscript/getroi.py` は削除した.

### 3. OpenCV は Linux/Android とも 4.14.0 に揃える

推論も OpenCV が担うので, **バージョンが違うと検出結果が変わりうる**. 両環境で同じバージョンを使う.

モデル (yolo26n ベース, クラスは `stack` のみ) を ONNX 化し, OpenCV の各バージョンで読めるか確かめた
(2026-10-12, 詳細は [worklog.md](worklog.md)).

| OpenCV | end2end 出力 `[1,300,6]` | 生出力 `[1,5,8400]` |
|---|---|---|
| 4.6.0 (Ubuntu apt) | 読込失敗 (TopK 非対応) | 推論時に失敗 |
| 4.8.1 / 4.10.0 | 読込失敗 (TopK 非対応) | OK |
| 4.14.0 | OK | OK |
| 5.0.0 | OK | OK |

- apt の 4.6 は使えないため, Linux はソースビルドする (`scripts/build_opencv.sh`, `third_party/` に入れる).
- 4.14.0 は 4.x 系の最新で, Android SDK (GitHub Releases) と Maven (`org.opencv:opencv`) の両方がある.
- 5.0 は出たばかりで API の変更があるため, 当面は 4.x 系にとどめる.

### 4. 検出器は2種類の出力形式を受け付け, どちらにも NMS をかける

YOLO26 は NMS が不要な end2end 形式で export できる. 一方, 古い OpenCV でも動くのは
NMS 前の生出力形式だけである. `YoloDetector` は出力の形で形式を判別し, どちらも扱う.

- `[1, N, 6]` (x1, y1, x2, y2, score, class): end2end.
- `[1, 4+nc, A]` (cx, cy, w, h, クラスごとのスコア): 生出力.

既定は end2end. モデル側の export 設定が変わっても pokerchip 側のコードを変えずに済む.

end2end は本来 NMS 不要だが, 同じスタックを2つ (スコア 0.86 と 0.51) 出す画像があった
(`IMG_5591.jpg`). 1つのスタックを2回数えるのはアプリとして誤りなので, どちらの形式にも
クラスごとの NMS (IoU 0.7) をかける.

### 5. 検出器の正しさは ultralytics + 同じ ONNX と比べて確かめる

`tests/test_detector.cpp` は C++ 版の検出結果を `pyscript/make_yolo_reference.py` の出力
(ultralytics で同じ ONNX を推論し, 同じ NMS をかけたもの) と比べる. 現状は全画像で一致する.

`best.pt` を ultralytics で直接使うと, 入力を正方形でなく長方形 (余白最小) にして推論するため,
ONNX (640x640 固定) と比べて矩形が数ピクセルずれ, 検出数が変わる画像もある.
基準を `best.pt` にすると前処理の差と実装の誤りを区別できないので, ONNX を基準にしている.

### 6. モデルはリポジトリ外から受け取る

- 学習はモデル側のリポジトリ (yoloPokerchip) の責任. 重みは git 管理されていないので,
  受け取った `best.pt` をこのリポジトリの `scripts/export_model.sh` で ONNX にして `models/` に置く.
- export 設定 (このリポジトリが期待する形):
  `format=onnx imgsz=640 opset=12 simplify=True dynamic=False end2end=True` (`scripts/export_model.sh` に書いてある)
- 入力サイズ (640) は今は固定値として core (`DetectorConfig`) に持つ. クラスは `stack` のみ.
  クラスが増えたり入力サイズが変わったりしたら, メタ情報ファイルを導入する.
- `models/VERSION` に変換元の `.pt` の sha256 を記録し, どの重みから作ったかを追えるようにする.
- Android では `android/app/src/main/assets/` にコピーして APK に同梱する.

### 7. ビルドは CMake に統一する

- Android Studio (Gradle) は NDK のビルドに CMake を使う. Linux も CMake にすれば
  `core/CMakeLists.txt` を両方から `add_subdirectory` するだけで共有できる.
- OpenCV のバージョン指定 (`find_package(OpenCV 4.14.0 EXACT ...)`) は `core/CMakeLists.txt` に
  1か所だけ書く. どちらの環境でも違うバージョンを掴むと configure の時点で失敗する.
- Android の OpenCV は SDK の静的ライブラリをリンクする. APK に `libopencv_java4.so` を入れずに済む.
- Android Studio なしでも `make android-native` で core + JNI を NDK でクロスコンパイルできる.
- 既存の `make run` / `make tidy` / `make format` は Makefile から CMake を呼ぶ形で残す.

### 8. Android アプリ

- Kotlin + Jetpack Compose. 点数計算のマッチの画面は Web ([web/app.md](web/app.md)) を WebView で表示し,
  アプリ自身は次の画面だけを持つ. 画面を Web と 2 重に作ると, 確認のダイアログなどの細かい振る舞いがずれるため.
  - 数えるだけの画面: 「撮影 / ギャラリー選択 → 解析 → 結果の表示」. 検出の結果を実機で確かめるために残す.
  - 検出画面と, 色と点数の設定画面: チップから持ち点を求め, Web の入力欄に入れる.
- アプリの画面は, WebView の画面の上に重ねて出す. WebView は閉じずに残し, 画面の回転でも Activity を作り直さない
  (`configChanges`). 検出画面から戻ったときに, 開いていたページと入力中の欄を保つため.
- WebView で開くのは接続先 (`BuildConfig.WEB_BASE_URL`) と同じオリジンのページだけで, 他のサイトは外のブラウザに渡す.
  Web とアプリの連絡 (bridge) は `androidx.webkit` の `addWebMessageListener` で, 接続先のページからだけ受ける.
  メッセージは JSON の文字で, 読み取り (`BridgeMessage.kt`) と URL の判定 (`OriginPolicy.kt`) は Android の API に触れない関数にして,
  JVM の単体テスト (`src/test/`) で確かめる.
- 解析の結果は, 元画像に枠と枚数を重ねた全体画像と, その下にスタックごとの確認画像を並べる.
  確認画像は ROI を広げて切り出し, 合わせ目に横線を引き, 右にチップごとの色を並べたもので,
  ユーザが枚数と色の正しさを一目で確かめられるようにする. ROI を広げるのは, ROI 自体のずれにも気づけるようにするため.
  描画は Compose で行い, core は合わせ目の位置 (JSON の `peaks`) を渡すだけにする. 文字が画面の解像度で描け, JNI も薄いまま済む.
- JNI は薄く: `nativeCreate(モデルのバイト列)`, `nativeAnalyze(Bitmap)`, `nativeRelease`.
  結果は JSON 文字列で返す (Kotlin 側でパースするだけで済み, JNI のコードが小さくなる).
  JSON は core の `toJson` が作るので, Linux の `--json` と同じ形式になる.
- EXIF の回転は Kotlin 側 (`ImageLoader`) で補正してから native に渡す.
  Linux の `cv::imread` も EXIF の向きを反映するので, 両環境で同じ向きの画像を解析する.
- 解析はバックグラウンドスレッドで行う. `cv::dnn::Net` はスレッドセーフでないので,
  Kotlin 側で `Mutex` を使って native の呼び出しを直列化する.
- Kotlin の書き方は [web/kotlin.md](web/kotlin.md) にまとめる.

| ファイル (`android/app/src/main/`) | 役割 |
|---|---|
| `cpp/CMakeLists.txt` | core + JNI のビルド |
| `cpp/jni_bridge.cpp` | Bitmap → `cv::Mat`, `analyzeImage` の呼び出し, 例外の受け渡し |
| `java/.../PokerChipNative.kt` | JNI のラッパー |
| `java/.../AnalysisResult.kt` | JSON → データクラス |
| `java/.../ImageLoader.kt` | Uri → Bitmap (EXIF の回転を補正) |
| `java/.../MainViewModel.kt` | 画像の読込と解析, 状態の保持 |
| `java/.../MainActivity.kt` | 画面の切り替え (WebView の画面の上に, ほかの画面を重ねる) |
| `java/.../web/` | WebView で開く URL の判定, 読み込みの様子, Web との連絡 (bridge) |
| `java/.../ui/WebScreen.kt` | マッチの画面 (WebView). 上のバー, 下に引いて更新, つながらないときの画面 |
| `java/.../ui/CountScreen.kt`, `ui/ResultViews.kt` | 数えるだけの画面 (撮影 / ギャラリー, 全体画像, スタックごとの確認画像) |
| `java/.../chips/` | チップの色の一覧, 色ごとの点数の読み取りと保存, 解析の結果から持ち点を求める関数 |
| `java/.../ChipValuesViewModel.kt`, `ui/ChipValuesScreen.kt` | 色と点数の設定画面 |
| `java/.../ui/ChipInputScreen.kt`, `ui/ChipPointsViews.kt` | 検出画面 (持ち点の内訳と合計, 求められない理由) |
| `debug/` | debug のビルドでだけ, 手元の `wrangler dev` (http://localhost) への平文の通信を許す |

### 9. 色の基準色は正解付きの画像から C++ の処理で求める

- 色判定は, チップの白い縞で照明を補正したあと, 各画素を Lab で最も近い基準色に分類して多数決をとる.
  基準色は `core/src/color.cpp` の定数表 (`kReferences`) として持つので, Android にもそのまま反映される.
- 基準色は今のチップセットから求めた値で, チップセットが変われば作り直す.
  作り直しは `pyscript/make_color_references.py` で行う. CLI の `--lab` で core にチップごとの代表色を出させ,
  `answers.txt` の正解の色ごとに中央値をとる.
- 代表色を Python で計算し直さず C++ に出させるのは, 判定と同じ補正がかかった値で基準色を作るため.
  補正を 2 か所で実装すると, 細かな違い (中央値や分位点の取り方) で基準色と判定がずれる.
- `tests/test_color.cpp` が `answers.txt` での正答率を確かめる. 基準色を同じ画像から作っているので,
  この正答率は初見の画像での性能より高く出る.

## 今後の課題

- リアルタイムプレビューでの解析 (CameraX).
- 推論速度が足りない場合の高速化 (入力サイズ縮小, NNAPI 等).
- 複数スタックの結果の見せ方.

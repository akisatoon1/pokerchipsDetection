# pokerchipsDetection

ポーカーチップのスタックの写真から, チップの枚数と色を求める.
同じ C++ のロジックを, Linux の CLI, ブラウザ (WebAssembly), Android アプリで動かす.
求めたチップから持ち点を出し, みんなで遊んだときの点数を記録する Web アプリもある.

## セットアップ

Ubuntu 24.04 を想定する. 詳しい手順と, うまくいかないときは [docs/environment/setup.md](docs/environment/setup.md) にある.

**1. clone して用意する**

```sh
git clone git@github.com:akisatoon1/pokerchipsDetection.git
cd pokerchipsDetection
make setup
```

`make setup` は OpenCV, Python の環境, モデル, Android と Web のビルドに要るものを作る. clone するたびに流す. 何回流してもよい.
Android や Web を使わないなら `scripts/setup.sh --skip-android --skip-web`.

**2. 足りないものを入れる (マシンに 1 回だけ)**

apt のパッケージ, Android Studio と SDK, Node.js など, マシンに入れるものは `make setup` は入れない.
足りなければ, 足りないものと入れ方 (apt のコマンドなど) を出して止まるので, 入れてから `make setup` を流し直す.
Android Studio と Node.js の入れ方は [docs/environment/setup.md](docs/environment/setup.md) にある.

**3. 動くか確かめる**

```sh
make test
```

## 文書

- [docs/README.md](docs/README.md): 文書の地図
- [docs/architecture.md](docs/architecture.md): 全体の設計と, そう決めた理由

# 下に引いたときの更新のぐるぐるを消す

承認日: 2026-10-18

## 人の指示

```
更新するために下にドラッグしたとき, ぐるぐるが消えない. 原因を調査して修正計画を立てよ
```

```
承認する. webscreen.ktの変更も許す
```

## 計画

### 原因

`android/app/src/main/java/com/pokerchip/app/ui/WebScreen.kt` で, ぐるぐるを出すかどうかの状態が 2 か所にあり, 食い違っている.

1. 下に引くと, `SwipeRefreshLayout` が自分の中でぐるぐるを出し, `setOnRefreshListener` を呼ぶ. このとき Compose 側の `isRefreshing` は `false` のまま.
2. 読み込みが終わると `onLoadFinished = { isRefreshing = false }` が走るが, すでに `false` なので値が変わらない.
3. Compose は値が変わったときだけ `AndroidView` の `update` を呼び直すので, `layout.isRefreshing = false` が一度も呼ばれず, ぐるぐるが残る.

エミュレータで, 下に引いてページの読み込みが終わったあともぐるぐるが残ること, そのあと「更新」ボタンを押しても消えないことを確かめた.

### 直し方

下に引いたときに, まず Compose 側の状態を `true` にしてから読み込み直す.

```kotlin
setOnRefreshListener {
    isRefreshing = true
    webView.reload()
}
```

状態は Compose 側の 1 か所にまとまり, 読み込みが終わって `false` を入れると値が変わるので `update` が呼ばれ, ぐるぐるが消える.
つながらないときも `onPageFinished` は呼ばれるので, 同じように消える. 「更新」ボタンの動き (ぐるぐるを出さずに読み込み直す) は変えない.

### 変えるファイル

| ファイル | 変えること |
|---|---|
| `android/app/src/main/java/com/pokerchip/app/ui/WebScreen.kt` | 上の 1 か所. 理由のコメントも書く |

### テストの観点

単体テストは足さない. 直すのは Compose と `SwipeRefreshLayout` のつなぎだけで, JVM で確かめられる規則がないため
(確かめるには Robolectric などの依存が要る). 代わりにエミュレータで次を確かめる.

- 下に引くと, 読み込みが終わったあとにぐるぐるが消える.
- 続けて 2 回引いても, そのたびに消える.
- サーバーを止めて下に引くと, ぐるぐるが消えて「つながりません」が出る.
- 「更新」ボタンを押しても, ぐるぐるは出ない (今までどおり).

### コミットの分け方

1. `docs: 計画 下に引いたときの更新のぐるぐるを消す を残す` (このファイル)
2. `fix: 下に引いて更新したあと, ぐるぐるが消えないのを直す` (進み具合のチェックもこのコミットで付ける)

### 承認されたこと

- この計画に限り, `android/app/src/main/java/com/pokerchip/app/ui/WebScreen.kt` の変更を許す.

## 進み具合

- [ ] 下に引いたあとのぐるぐるを消す

## 計画の変更

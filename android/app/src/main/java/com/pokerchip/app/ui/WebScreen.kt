package com.pokerchip.app.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.JavaScriptReplyProxy
import com.pokerchip.app.BuildConfig
import com.pokerchip.app.web.AppWebViewClient
import com.pokerchip.app.web.BridgeMessage
import com.pokerchip.app.web.UrlAction
import com.pokerchip.app.web.WebBridge
import com.pokerchip.app.web.decideUrlAction

/**
 * マッチの画面 (Web) を WebView で出す画面.
 *
 * 上のバーに戻る, 更新, メニューを置き, 下に引いても更新できる. 他の人の入力はポーリングしないので,
 * ブラウザのリロードの代わりに要る (docs/web/app.md).
 * @param baseUrl 接続先. 最初にここのトップページを開く.
 * @param isActive この画面が前に出ているか. 他の画面を重ねている間は false にし, 戻るボタンを譲る.
 * @param onOpenCount メニューの「数えるだけ」を選んだとき.
 * @param onOpenChipValues メニューの「色と点数の設定」を選んだとき.
 * @param onStartChipInput Web の「チップから入力」が押されたとき. 持ち点を Web に返す口を渡す.
 */
@Composable
fun WebScreen(
    baseUrl: String,
    isActive: Boolean,
    onOpenCount: () -> Unit,
    onOpenChipValues: () -> Unit,
    onStartChipInput: (JavaScriptReplyProxy) -> Unit,
) {
    val context = LocalContext.current
    var canGoBack by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    var hasError by remember { mutableStateOf(false) }
    var isMenuOpen by remember { mutableStateOf(false) }
    // アプリが裏で終了されても, 開いていたページに戻れるようにする.
    var lastUrl by rememberSaveable { mutableStateOf(baseUrl) }
    // 描画のプロセスが落ちて WebView が使えなくなったら, これを増やして作り直す.
    var webViewGeneration by remember { mutableIntStateOf(0) }

    val webView = remember(webViewGeneration) {
        createWebView(
            context,
            AppWebViewClient(
                baseUrl = baseUrl,
                onOpenExternally = { uri -> openExternally(context, uri) },
                onLoadStarted = { hasError = false },
                onLoadFinished = { isRefreshing = false },
                onMainFrameError = { hasError = true },
                onHistoryChanged = { url, canGoBackNow ->
                    lastUrl = url
                    canGoBack = canGoBackNow
                },
                onRendererGone = { webViewGeneration++ },
            ),
        ).apply {
            WebBridge(baseUrl) { message, reply ->
                when (message) {
                    is BridgeMessage.CopyText -> copyUrl(context, message.text, baseUrl)
                    BridgeMessage.StartChipInput -> onStartChipInput(reply)
                }
            }.install(this)
            loadUrl(lastUrl)
        }
    }
    DisposableEffect(webView) {
        onDispose { webView.destroy() }
    }
    // WebView の中で 1 つ前に戻る. 戻れないときは譲り, アプリを閉じる.
    BackHandler(enabled = isActive && canGoBack) { webView.goBack() }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "点数計算",
                onBack = { webView.goBack() },
                isBackEnabled = canGoBack,
            ) {
                TextButton(onClick = { webView.reload() }) { Text("更新") }
                Box {
                    TextButton(onClick = { isMenuOpen = true }) { Text("⋮") }
                    DropdownMenu(expanded = isMenuOpen, onDismissRequest = { isMenuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("数えるだけ") },
                            onClick = {
                                isMenuOpen = false
                                onOpenCount()
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("色と点数の設定") },
                            onClick = {
                                isMenuOpen = false
                                onOpenChipValues()
                            },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                // 下のほうの入力欄がキーボードに隠れないようにする.
                .imePadding(),
        ) {
            // WebView を作り直したら, それを入れる枠も作り直す.
            key(webView) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { viewContext ->
                        SwipeRefreshLayout(viewContext).apply {
                            addView(webView)
                            setOnRefreshListener {
                                // 引くと SwipeRefreshLayout が自分でぐるぐるを出す. こちらの状態も true にしておかないと,
                                // 読み込みのあとに false を入れても値が変わらず update が呼ばれないので, ぐるぐるが消えない.
                                isRefreshing = true
                                webView.reload()
                            }
                        }
                    },
                    update = { layout ->
                        layout.isRefreshing = isRefreshing
                        // 他の画面を重ねている間は隠す. 消さずに残すのは, 入力中の欄やページの状態を保つため.
                        layout.visibility = if (isActive) View.VISIBLE else View.INVISIBLE
                    },
                )
            }
            if (hasError) {
                ConnectionError(onRetry = { webView.reload() })
            }
        }
    }
}

/** サーバーにつながらないときに, WebView のエラー画面の代わりに出す. */
@Composable
private fun ConnectionError(onRetry: () -> Unit) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("つながりません", style = MaterialTheme.typography.titleLarge)
            Text("サーバーに接続できませんでした. ネットワークを確かめて, もう一度試してください.")
            Button(onClick = onRetry) { Text("再試行") }
        }
    }
}

// JavaScript は Web の画面を動かすのに要る. 開くのは接続先のページだけに絞ってある (AppWebViewClient).
private fun createWebView(context: Context, client: AppWebViewClient): WebView {
    // debug のビルドでだけ, PC の Chrome (chrome://inspect) から中を調べられるようにする.
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    return WebView(context).apply {
        settings.javaScriptEnabled = true
        // トークンを localStorage に保存するため (docs/web/app.md).
        settings.domStorageEnabled = true
        // 端末のファイルを読ませない.
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        webViewClient = client
    }
}

// 参加の URL をコピーする. Web のページが頼めるのは URL のコピーなので, 接続先のページの URL だけを受ける.
private fun copyUrl(context: Context, text: String, baseUrl: String) {
    if (decideUrlAction(text, baseUrl) != UrlAction.OPEN_IN_APP) return
    val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return
    clipboard.setPrimaryClip(ClipData.newPlainText("マッチの URL", text))
}

private fun openExternally(context: Context, uri: Uri) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
    } catch (_: ActivityNotFoundException) {
        Toast.makeText(context, "開けるアプリがありません", Toast.LENGTH_SHORT).show()
    }
}

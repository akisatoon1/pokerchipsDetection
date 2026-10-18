package com.pokerchip.app.ui

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File

/**
 * 撮影とギャラリーのボタン. 選んだ画像の Uri を渡す.
 *
 * @param isEnabled 押せるか. 解析中は押せないようにする.
 * @param onPicked 撮影した, または選んだ画像を受ける.
 */
@Composable
fun ImagePickButtons(isEnabled: Boolean, onPicked: (Uri) -> Unit) {
    val context = LocalContext.current
    // カメラアプリに渡した保存先. 撮影から戻ったときに使う.
    var pendingCapture by rememberSaveable { mutableStateOf<Uri?>(null) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = pendingCapture
        if (ok && uri != null) onPicked(uri)
    }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) onPicked(uri)
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            enabled = isEnabled,
            onClick = {
                val uri = createCaptureUri(context)
                pendingCapture = uri
                takePicture.launch(uri)
            },
        ) { Text("撮影") }
        Button(
            enabled = isEnabled,
            onClick = {
                pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            },
        ) { Text("ギャラリー") }
    }
}

/** カメラアプリに渡す保存先を cache/captures/ に作る (res/xml/file_paths.xml). */
private fun createCaptureUri(context: Context): Uri {
    val dir = File(context.cacheDir, "captures").apply { mkdirs() }
    val file = File(dir, "capture_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

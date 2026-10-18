plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.pokerchip.app"
    compileSdk = 37
    // scripts/fetch_android_deps.sh と同じ NDK (r30). r28 以降は 16KB ページ整列が既定.
    ndkVersion = "30.0.16248370"

    defaultConfig {
        applicationId = "com.pokerchip.app"
        // Android 15 以上だけを対象にする. 古い版との互換のための処理は持たない.
        minSdk = 35
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"

        ndk {
            // 実機 (arm64) とエミュレータ (x86_64).
            abiFilters += listOf("arm64-v8a", "x86_64")
        }
        externalNativeBuild {
            cmake {
                arguments += listOf("-DANDROID_STL=c++_shared")
            }
        }
    }

    buildTypes {
        debug {
            // 手元の wrangler dev. adb reverse tcp:8787 tcp:8787 で PC に届ける (docs/web/running.md).
            // エミュレータでも実機でも同じ URL で試せるようにするため.
            buildConfigField("String", "WEB_BASE_URL", "\"http://localhost:8787\"")
        }
        release {
            isMinifyEnabled = false
            // 本番にデプロイするときに, 本番の URL に替える.
            buildConfigField("String", "WEB_BASE_URL", "\"https://example.invalid\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // core (リポジトリ直下) を含むネイティブのビルド. 中身は src/main/cpp/CMakeLists.txt.
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.31.6"
        }
    }

    // ONNX を圧縮せずに APK に入れる.
    androidResources {
        noCompress += "onnx"
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.swiperefreshlayout)
    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
    testImplementation(libs.json)
}

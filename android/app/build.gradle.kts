plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.pokerchip.app"
    compileSdk = 37
    // NDK r30. r28 以降は 16KB ページ整列が既定. make android-native もこの版を使う (scripts/lib/android.sh).
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
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
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

// モデルは models/chip_detector.onnx の 1 つだけを使い, ビルドのときに assets に入れる.
// assets に写しておく方式だと, モデルを替えたときに写し忘れて, 古いモデルのまま動くため.
// モデルがなければ, このタスクがビルドを止める (scripts/setup.sh で用意する).
abstract class CopyModelToAssets : DefaultTask() {
    @get:InputFile
    abstract val model: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val source = model.get().asFile
        val outDir = outputDir.get().asFile
        outDir.deleteRecursively()
        source.copyTo(outDir.resolve(source.name))
    }
}

androidComponents {
    onVariants { variant ->
        val copyModel = tasks.register<CopyModelToAssets>(
            "copy${variant.name.replaceFirstChar { it.uppercase() }}ModelToAssets",
        ) {
            model.set(rootProject.layout.projectDirectory.file("../models/chip_detector.onnx"))
            outputDir.set(layout.buildDirectory.dir("generated/model/${variant.name}"))
        }
        variant.sources.assets?.addGeneratedSourceDirectory(copyModel, CopyModelToAssets::outputDir)
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
    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
}

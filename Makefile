# CMake のラッパー. よく使う操作を短く呼べるようにする.
# ビルドの本体は CMakeLists.txt (Linux) と android/ (Android).

.PHONY: all setup build run test model android-native android-run web-dev tidy tidy-fix format format-check check clean

ARGS ?= testimages/v1/yoko/stack/singlecolor/IMG_5587.jpg
PT ?= best.pt

BUILDDIR = build
TARGET = $(BUILDDIR)/pokerchip

SRCS = $(wildcard core/src/*.cpp cli/*.cpp)
HDRS = $(wildcard core/include/pokerchip/*.hpp cli/*.hpp)
JNI_SRCS = $(wildcard android/app/src/main/cpp/*.cpp)

# core と cli のみを対象にする. OpenCV などのヘッダの指摘は出さない.
TIDYFLAGS = -p $(BUILDDIR) --header-filter='^$(CURDIR)/(core|cli)/'

all: build

$(BUILDDIR)/CMakeCache.txt:
	cmake -S . -B $(BUILDDIR)

build: $(BUILDDIR)/CMakeCache.txt
	cmake --build $(BUILDDIR) -j

run: build
	./$(TARGET) $(ARGS)

# 正解付きの画像で全体テストを流す (functional_tests/evaluate.py).
# データセットごとに結果を分けて出す. どの撮り方で崩れたかが分かるようにするため.
# 1 つだけ流すときは make test TEST_DATASETS=testimages/v2/yoko/with_far_stacks のように渡す.
TEST_DATASETS = testimages/v2/yoko/single_color testimages/v2/yoko/with_far_stacks

test: build
	@for dataset in $(TEST_DATASETS); do \
		echo "== $$dataset"; \
		python3 functional_tests/evaluate.py $$dataset || exit 1; \
	done

# git clone したあとのセットアップ. 何回流してもよい (docs/environment/setup.md).
# Android や Web を使わないなら scripts/setup.sh --skip-android --skip-web のように直に呼ぶ.
setup:
	scripts/setup.sh

# 新しい重み (.pt) からモデルを書き出し直す.
model:
	scripts/export_model.sh $(PT)

# core + JNI が Android 向けにビルドできるかを確かめる (Android Studio 不要).
android-native:
	scripts/check_android_native.sh

# アプリをビルドして USB で繋いだ端末に入れ, 起動する (Android Studio 不要).
android-run:
	scripts/run_android.sh

# Web のサーバーを手元に立てる (docs/web/running.md). 先に検出器を作り直す.
# npm run dev は検出器を作らないので, core を変えたあとに古い検出器で動かないようにするため.
# cmake は変わったところだけを作るので, core を変えていなければすぐ終わる.
# スマートフォンから試すことが多いので, いつも LAN からも開けるように立てる (--ip 0.0.0.0).
# 同じネットワークの誰からでも開けるので, 信頼できるネットワークでだけ使う.
web-dev:
	scripts/build_wasm.sh
	cd web && npm run dev -- --ip 0.0.0.0

#
# コードスタイルとフォーマットについて
#

tidy: build
	clang-tidy $(TIDYFLAGS) --warnings-as-errors='*' $(SRCS)

tidy-fix: build
	clang-tidy $(TIDYFLAGS) --fix $(SRCS)
	$(MAKE) format

format:
	clang-format -i $(SRCS) $(HDRS) $(JNI_SRCS)

format-check:
	clang-format --dry-run --Werror $(SRCS) $(HDRS) $(JNI_SRCS)

check: format-check tidy

clean:
	rm -rf $(BUILDDIR)

# CMake のラッパー. よく使う操作を短く呼べるようにする.
# ビルドの本体は CMakeLists.txt (Linux) と android/ (Android).

.PHONY: all build run test opencv model android-deps android-native android-run tidy tidy-fix format format-check check clean

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

# 環境構築
opencv:
	scripts/build_opencv.sh

model:
	scripts/export_model.sh $(PT)

android-deps:
	scripts/fetch_android_deps.sh

# core + JNI が Android 向けにビルドできるかを確かめる (Android Studio 不要).
android-native:
	scripts/check_android_native.sh

# アプリをビルドして USB で繋いだ端末に入れ, 起動する (Android Studio 不要).
android-run:
	scripts/run_android.sh

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

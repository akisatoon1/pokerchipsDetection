# CMake のラッパー. よく使う操作を短く呼べるようにする.
# ビルドの本体は CMakeLists.txt (Linux) と android/ (Android).

.PHONY: all build run test opencv model android-deps android-native tidy tidy-fix format format-check check clean

ARGS ?= testimages/yoko/stack/singlecolor/IMG_5587.jpg
PT ?= best.pt

BUILDDIR = build
TARGET = $(BUILDDIR)/pokerchip

SRCS = $(wildcard core/src/*.cpp cli/*.cpp)
HDRS = $(wildcard core/include/pokerchip/*.hpp cli/*.hpp)
JNI_SRCS = $(wildcard android/app/src/main/cpp/*.cpp)
TEST_SRCS = $(wildcard tests/*.cpp)

# core と cli のみを対象にする. OpenCV などのヘッダの指摘は出さない.
TIDYFLAGS = -p $(BUILDDIR) --header-filter='^$(CURDIR)/(core|cli)/'

all: build

$(BUILDDIR)/CMakeCache.txt:
	cmake -S . -B $(BUILDDIR)

build: $(BUILDDIR)/CMakeCache.txt
	cmake --build $(BUILDDIR) -j

run: build
	./$(TARGET) $(ARGS)

test: build
	ctest --test-dir $(BUILDDIR) --output-on-failure

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

#
# コードスタイルとフォーマットについて
#

tidy: build
	clang-tidy $(TIDYFLAGS) --warnings-as-errors='*' $(SRCS)

tidy-fix: build
	clang-tidy $(TIDYFLAGS) --fix $(SRCS)
	$(MAKE) format

format:
	clang-format -i $(SRCS) $(HDRS) $(TEST_SRCS) $(JNI_SRCS)

format-check:
	clang-format --dry-run --Werror $(SRCS) $(HDRS) $(TEST_SRCS) $(JNI_SRCS)

check: format-check tidy

clean:
	rm -rf $(BUILDDIR)

.PHONY: run clean tidy tidy-fix format format-check check

ARGS ?= testimages/chips.png

SRCDIR = src
OBJDIR = build
TARGET = $(OBJDIR)/main
COMPILE_DB = $(OBJDIR)/compile_commands.json

SRCS = $(SRCDIR)/main.cpp $(SRCDIR)/roi.cpp $(SRCDIR)/counting.cpp $(SRCDIR)/visualize.cpp
HDRS = $(SRCDIR)/roi.hpp $(SRCDIR)/counting.hpp $(SRCDIR)/visualize.hpp
OBJS = $(SRCS:$(SRCDIR)/%.cpp=$(OBJDIR)/%.o)
DEPS = $(OBJS:.o=.d)

CXXFLAGS = -std=c++17 -Wall -Wextra -pedantic -MMD -MP `pkg-config --cflags opencv4`
LDLIBS = `pkg-config --libs opencv4`

# src配下のみを対象にする. OpenCVなどのシステムヘッダの指摘は出さない.
TIDYFLAGS = -p $(OBJDIR) --header-filter='^$(SRCDIR)/'

$(TARGET): $(OBJS)
	g++ $(OBJS) -o $@ $(LDLIBS)

$(OBJDIR)/%.o: $(SRCDIR)/%.cpp | $(OBJDIR)
	g++ $(CXXFLAGS) -c $< -o $@

$(OBJDIR):
	mkdir -p $(OBJDIR)

run: $(TARGET)
	./$(TARGET) $(ARGS)

# clang-tidyが参照するコンパイルデータベース. ソースの増減を追えるようMakefileにも依存させる.
$(COMPILE_DB): $(SRCS) Makefile | $(OBJDIR)
	bear --output $@ -- $(MAKE) --always-make $(TARGET)

# スタイルガイド(.clang-tidy)に沿っているかチェックする. 指摘があれば失敗する.
tidy: $(COMPILE_DB)
	clang-tidy $(TIDYFLAGS) --warnings-as-errors='*' $(SRCS)

# 自動修正できる指摘を修正する. 波括弧の挿入などでインデントが崩れるので整形もかける.
tidy-fix: $(COMPILE_DB)
	clang-tidy $(TIDYFLAGS) --fix $(SRCS)
	$(MAKE) format

# .clang-formatに従って整形する.
format:
	clang-format -i $(SRCS) $(HDRS)

# 整形済みかどうかをチェックする. 崩れていれば失敗する.
format-check:
	clang-format --dry-run --Werror $(SRCS) $(HDRS)

# スタイルのチェックをまとめて実行する.
check: format-check tidy

clean:
	rm -rf $(OBJDIR)

-include $(DEPS)

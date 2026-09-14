.PHONY: run clean tidy tidy-fix format format-check check test-roi

ARGS ?= testimages/chips.png

SRCDIR = src
TESTDIR = test
OBJDIR = build
TARGET = $(OBJDIR)/main
COMPILE_DB = $(OBJDIR)/compile_commands.json

SRCS = $(SRCDIR)/main.cpp $(SRCDIR)/roi.cpp $(SRCDIR)/counting.cpp $(SRCDIR)/visualize.cpp $(SRCDIR)/env.cpp
HDRS = $(SRCDIR)/roi.hpp $(SRCDIR)/counting.hpp $(SRCDIR)/visualize.hpp $(SRCDIR)/env.hpp
OBJS = $(SRCS:$(SRCDIR)/%.cpp=$(OBJDIR)/%.o)
DEPS = $(OBJS:.o=.d) $(OBJDIR)/test_selectRoiWithYOLO.d

CXXFLAGS = -std=c++17 -Wall -Wextra -pedantic -MMD -MP `pkg-config --cflags opencv4`
LDLIBS = `pkg-config --libs opencv4`

# src配下のみを対象にする. OpenCVなどのシステムヘッダの指摘は出さない.
TIDYFLAGS = -p $(OBJDIR) --header-filter='^$(SRCDIR)/'

#
# build
#

$(TARGET): $(OBJS)
	g++ $(OBJS) -o $@ $(LDLIBS)

$(OBJDIR)/%.o: $(SRCDIR)/%.cpp | $(OBJDIR)
	g++ $(CXXFLAGS) -c $< -o $@

$(OBJDIR):
	mkdir -p $(OBJDIR)

run: $(TARGET)
	./$(TARGET) $(ARGS)

#
# test
#

$(OBJDIR)/test_selectRoiWithYOLO: $(TESTDIR)/test_selectRoiWithYOLO.cpp $(OBJDIR)/roi.o $(OBJDIR)/env.o | $(OBJDIR)
	g++ $(CXXFLAGS) -I$(SRCDIR) $(TESTDIR)/test_selectRoiWithYOLO.cpp $(OBJDIR)/roi.o $(OBJDIR)/env.o -o $@ $(LDLIBS)

test-selectRoiWithYOLO: $(OBJDIR)/test_selectRoiWithYOLO
	./$(OBJDIR)/test_selectRoiWithYOLO

#
# コードスタイルとフォーマットについて
#

# clang-tidyが参照するコンパイルデータベース. ソースの増減を追えるようMakefileにも依存させる.
$(COMPILE_DB): $(SRCS) Makefile | $(OBJDIR)
	bear --output $@ -- $(MAKE) --always-make $(TARGET)

tidy: $(COMPILE_DB)
	clang-tidy $(TIDYFLAGS) --warnings-as-errors='*' $(SRCS)

tidy-fix: $(COMPILE_DB)
	clang-tidy $(TIDYFLAGS) --fix $(SRCS)
	$(MAKE) format

format:
	clang-format -i $(SRCS) $(HDRS)

format-check:
	clang-format --dry-run --Werror $(SRCS) $(HDRS)

check: format-check tidy

clean:
	rm -rf $(OBJDIR)

-include $(DEPS)

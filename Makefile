.PHONY: run clean

ARGS ?= testimages/chips.png

SRCDIR = src
OBJDIR = build
TARGET = $(OBJDIR)/main

SRCS = $(SRCDIR)/main.cpp $(SRCDIR)/roi.cpp $(SRCDIR)/counting.cpp $(SRCDIR)/visualize.cpp
OBJS = $(SRCS:$(SRCDIR)/%.cpp=$(OBJDIR)/%.o)
DEPS = $(OBJS:.o=.d)

CXXFLAGS = -std=c++17 -Wall -Wextra -pedantic -MMD -MP `pkg-config --cflags opencv4`
LDLIBS = `pkg-config --libs opencv4`

$(TARGET): $(OBJS)
	g++ $(OBJS) -o $@ $(LDLIBS)

$(OBJDIR)/%.o: $(SRCDIR)/%.cpp | $(OBJDIR)
	g++ $(CXXFLAGS) -c $< -o $@

$(OBJDIR):
	mkdir -p $(OBJDIR)

run: $(TARGET)
	./$(TARGET) $(ARGS)

clean:
	rm -rf $(TARGET) $(OBJDIR)

-include $(DEPS)

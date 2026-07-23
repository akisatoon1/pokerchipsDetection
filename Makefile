.PHONY: run

TARGET = main
ARGS ?=

$(TARGET): $(TARGET).cpp
	g++ -std=c++17 -Wall -Wextra -pedantic -o $(TARGET) $(TARGET).cpp

run: $(TARGET)
	./$(TARGET) $(ARGS)

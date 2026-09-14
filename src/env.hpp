// 環境変数を管理する

#pragma once

#include <string>

// yoloを実行するための環境変数.
extern std::string PYTHON_BIN_PATH;
extern std::string PYTHON_SCRIPT_PATH;
extern std::string USER_OR_YOLO;  // "user" or "yolo"

void loadEnvs();

// 環境変数を管理する

#pragma once

#include <string>

extern std::string PYTHON_BIN_PATH;
extern std::string PYTHON_SCRIPT_PATH;

void loadEnvs();

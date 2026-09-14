#include <cstdlib>
#include <stdexcept>
#include <string>

std::string PYTHON_BIN_PATH;
std::string PYTHON_SCRIPT_PATH;
std::string USER_OR_YOLO;

std::string getEnvVar(const std::string& varName) {
  const char* value = std::getenv(varName.c_str());
  if (value == nullptr) {
    throw std::runtime_error("Environment variable " + varName +
                             " is not set.");
  }
  return std::string(value);
}

void loadEnvs() {
  PYTHON_BIN_PATH = getEnvVar("PYTHON_BIN_PATH");
  PYTHON_SCRIPT_PATH = getEnvVar("PYTHON_SCRIPT_PATH");
  USER_OR_YOLO = getEnvVar("USER_OR_YOLO");
}

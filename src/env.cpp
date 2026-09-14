#include <cstdlib>
#include <stdexcept>
#include <string>

std::string PYTHON_BIN_PATH;
std::string PYTHON_SCRIPT_PATH;

void loadEnvs() {
  const char* python_bin_path = std::getenv("PYTHON_BIN_PATH");
  if (python_bin_path != nullptr) {
    PYTHON_BIN_PATH = python_bin_path;
  } else {
    throw std::runtime_error(
        "Environment variable PYTHON_BIN_PATH is not set.");
  }

  const char* python_script_path = std::getenv("PYTHON_SCRIPT_PATH");
  if (python_script_path != nullptr) {
    PYTHON_SCRIPT_PATH = python_script_path;
  } else {
    throw std::runtime_error(
        "Environment variable PYTHON_SCRIPT_PATH is not set.");
  }
}

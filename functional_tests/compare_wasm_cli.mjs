// WASM の core と Linux の CLI で同じ画像を解析し, 結果が一致するかを確かめる.
// Web と Linux で同じロジックが同じ結果を出すことを保証するため (docs/architecture.md).
//
// 使い方は compare_wasm_cli.sh から呼ぶ:
//   node compare_wasm_cli.mjs <WASM の .js> <モデル> <CLI> <decode_rgba> <作業用ディレクトリ> <画像>...
// 一致しない画像が 1 つでもあれば, 違う値を出して終了コード 1 で終わる.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

/** score の差の許容. score は表示にしか使わないので, 小さな差は許す. */
const SCORE_TOLERANCE = 0.001;

/** Workers の Static Assets で配れる 1 ファイルの上限 (25 MiB). */
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

const [wasmJs, modelPath, cliPath, decodePath, workDir, ...images] =
  process.argv.slice(2);

const { default: createPokerChipModule } = await import(
  pathToFileURL(wasmJs).href
);
const core = await createPokerChipModule();
const created = core.createDetector(readFileSync(modelPath));
if (!created.ok) {
  throw new Error(`検出器を作れない: ${created.error}`);
}
const detector = created.detector;

const failures = [];
checkAssetSizes(failures);
checkErrors(failures);
for (const image of images) {
  compareImage(image, failures);
}
detector.delete();

for (const failure of failures) {
  console.log(`NG ${failure}`);
}
console.log(
  `${images.length} 枚を比べた. 一致しないもの・失敗した確認: ${failures.length} 件`,
);
process.exit(failures.length === 0 ? 0 : 1);

// 配るファイルが Static Assets の上限に収まるかを確かめる.
function checkAssetSizes(failures) {
  const wasmPath = wasmJs.replace(/\.js$/, ".wasm");
  for (const path of [wasmJs, wasmPath, modelPath]) {
    const size = statSync(path).size;
    console.log(`size ${basename(path)}: ${(size / 1024 / 1024).toFixed(1)} MiB`);
    if (size > MAX_ASSET_BYTES) {
      failures.push(`${basename(path)} が 25 MiB を超える (${size} バイト)`);
    }
  }
}

// 不正な入力で落ちずに, 理由の付いた失敗が返るかを確かめる.
function checkErrors(failures) {
  const empty = detector.analyze(new Uint8Array(0), 0, 0);
  if (empty.ok || typeof empty.error !== "string") {
    failures.push("空の画像で失敗が返らない");
  }
  const mismatched = detector.analyze(new Uint8Array(4 * 3), 2, 2);
  if (mismatched.ok || typeof mismatched.error !== "string") {
    failures.push("画素の数が大きさと合わないのに失敗が返らない");
  }
  const broken = core.createDetector(new Uint8Array([1, 2, 3, 4]));
  if (broken.ok || typeof broken.error !== "string") {
    failures.push("壊れたモデルで失敗が返らない");
  }
}

// 1 枚の画像を両方で解析して比べる.
function compareImage(image, failures) {
  const expected = runCli(image);
  const { width, height, pixels } = decode(image);
  const started = performance.now();
  const analyzed = detector.analyze(pixels, width, height);
  const elapsed = performance.now() - started;
  if (!analyzed.ok) {
    failures.push(`${image}: WASM が失敗した: ${analyzed.error}`);
    return;
  }
  const actual = JSON.parse(analyzed.json);
  const differences = diffResults(expected, actual);
  const status = differences.length === 0 ? "OK" : "NG";
  console.log(
    `${status} ${image} (${width}x${height}, ${actual.stacks.length} stacks, ${elapsed.toFixed(0)} ms)`,
  );
  for (const difference of differences) {
    failures.push(`${image}: ${difference}`);
  }
}

// CLI で解析し, JSON の結果を返す. スタックが見つからないときは CLI が失敗で終わるので, 空の結果とみなす.
function runCli(image) {
  const debugImage = join(workDir, "debug.png");
  let output;
  try {
    output = execFileSync(cliPath, ["--json", "--out", debugImage, image], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (String(error.stderr).includes("ROI was not selected")) {
      return { stacks: [] };
    }
    throw error;
  }
  const line = output.split("\n").find((text) => text.startsWith("{"));
  if (line === undefined) {
    throw new Error(`${image}: CLI の出力に JSON がない`);
  }
  return JSON.parse(line);
}

// decode_rgba で CLI と同じ読み方をした RGBA の画素を得る.
function decode(image) {
  const rgbaPath = join(workDir, "image.rgba");
  execFileSync(decodePath, [image, rgbaPath]);
  const data = readFileSync(rgbaPath);
  return {
    width: data.readUInt32LE(0),
    height: data.readUInt32LE(4),
    pixels: data.subarray(8),
  };
}

// 2 つの結果の違いを, 人が読める文の一覧にする.
function diffResults(expected, actual) {
  if (expected.stacks.length !== actual.stacks.length) {
    return [
      `スタックの数が違う (CLI ${expected.stacks.length}, WASM ${actual.stacks.length})`,
    ];
  }
  const differences = [];
  expected.stacks.forEach((want, index) => {
    const got = actual.stacks[index];
    for (const key of ["box", "count", "peaks", "colors"]) {
      if (JSON.stringify(want[key]) !== JSON.stringify(got[key])) {
        differences.push(
          `stack ${index} の ${key} が違う (CLI ${JSON.stringify(want[key])}, WASM ${JSON.stringify(got[key])})`,
        );
      }
    }
    if (Math.abs(want.score - got.score) > SCORE_TOLERANCE) {
      differences.push(
        `stack ${index} の score が違う (CLI ${want.score}, WASM ${got.score})`,
      );
    }
  });
  return differences;
}

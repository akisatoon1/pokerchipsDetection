import type { AnalysisResult } from "../../rules/analysis-result";
import type { ChipColorName } from "../../rules/chip-values";
import {
  applyColorCorrections,
  correctChipColor,
  countCorrectedChips,
  NO_CORRECTIONS,
  revertChipColor,
  type ChipPosition,
  type ColorCorrections,
} from "../../rules/color-corrections";
import { analyzeImage, type Analysis } from "../detector";
import { element } from "../dom";
import {
  renderResultImage,
  renderResultSummary,
  type ResultSummary,
} from "../result-views";

/** 表示の幅が測れないとき (画面に入る前など) に使う幅 (CSS px). */
const FALLBACK_WIDTH = 320;

/**
 * 一度に持てる写真の枚数の上限.
 *
 * 写真ごとに全体画像と確認画像の canvas を持つので, 端末のメモリを使いすぎないよう上限を置く.
 */
const MAX_PHOTOS = 10;

/** 撮影 / 写真の選択 → 解析 → 結果の表示をまとめた部品. 数えるだけの画面と検出画面で使う. */
export interface ChipAnalysisPanel {
  /** ボタン, 解析の様子, 結果を入れた要素. */
  container: HTMLElement;
  /** 解析を止め, 結果を手放す. 部品を画面から外すときに呼ぶ. */
  dispose(): void;
}

/** 部品の, 使う画面ごとに違うところ. */
export interface ChipAnalysisOptions {
  /**
   * 写真の一覧の上に出すもの (すべての写真から求めた持ち点など).
   *
   * 写真を足す・外す, チップの色を直すたびに呼ぶ. 写真が 1 枚もなければ呼ばない.
   * @param photos すべての写真の, 手で直した色を当てた結果. 撮った・選んだ順.
   * @param correctedChipCount すべての写真で, 手で色を直したチップの枚数.
   */
  renderHeader(
    photos: AnalysisResult[],
    correctedChipCount: number,
  ): HTMLElement;
  /** 写真ごとの表示の下に出すもの (かかった時間など). なければ何も出さない. */
  renderFooter?(analysis: Analysis): HTMLElement;
}

/** 一覧の 1 枚の写真. */
interface Photo {
  /** core の解析の結果 (直す前). */
  detected: AnalysisResult;
  /** 手で直したチップの色. 写真を外したら, いっしょに消える. */
  corrections: ColorCorrections;
  /** 写真ごとの表示. */
  view: HTMLDetailsElement;
  /** 表示の見出し. 番号を振り直すときに書き換える. */
  title: HTMLElement;
  /** 確認画像と「色を直す」の欄. 色を直したら映す. */
  summary: ResultSummary;
}

/**
 * 撮影するか写真を選び, チップを解析して結果を出す部品を作る.
 *
 * 写真は何枚でも足せ (上限 MAX_PHOTOS), すべての写真のチップを合わせて扱う. チップが 1 枚の写真に収まらないとき,
 * 分けて撮れるようにするため (docs/web/app.md). 撮影は 1 回に 1 枚, 写真の選択は 1 回に何枚でも選べる.
 * 結果は, 上に options.renderHeader, その下に写真ごとの表示 (全体画像, スタックごとの確認画像, options.renderFooter).
 * @param options 使う画面ごとに違うところ.
 * @returns 部品.
 */
export function createChipAnalysisPanel(
  options: ChipAnalysisOptions,
): ChipAnalysisPanel {
  const status = element("p", { attributes: { role: "status" } });
  const header = element("div");
  const list = element("div", { className: "photo-list" });
  const photos: Photo[] = [];
  let isDisposed = false;

  const refresh = (): void => {
    photos.forEach((photo, index) => {
      photo.title.textContent = describePhoto(index + 1, photo);
    });
    header.replaceChildren(
      ...(photos.length === 0 ? [] : [renderPhotosHeader(photos, options)]),
    );
    pickers.setPhotoCount(photos.length);
  };
  const remove = (photo: Photo): void => {
    photos.splice(photos.indexOf(photo), 1);
    photo.view.remove();
    refresh();
  };
  // 持ち点は直した色から求めるので, 直すたびに見出しと持ち点を出し直す.
  const correct = (
    photo: Photo,
    position: ChipPosition,
    color: ChipColorName | null,
  ): void => {
    photo.corrections =
      color === null
        ? revertChipColor(photo.corrections, position)
        : correctChipColor(photo.detected, photo.corrections, position, color);
    photo.summary.update(photo.corrections);
    refresh();
  };
  const add = (analysis: Analysis): void => {
    const photo = renderPhoto(analysis, {
      list,
      footer: options.renderFooter?.(analysis),
      onRemove: () => {
        remove(photo);
      },
      onColorChange: (position, color) => {
        correct(photo, position, color);
      },
    });
    photos.push(photo);
    refresh();
  };
  const pickers = renderImagePickers((files) => {
    void analyzeFiles(files, {
      roomLeft: () => MAX_PHOTOS - photos.length,
      isDisposed: () => isDisposed,
      onAnalyzed: add,
      setBusy: pickers.setBusy,
      status,
    });
  });
  return {
    container: element("div", { className: "chip-analysis" }, [
      pickers.container,
      element("p", {
        className: "note",
        text: "1 枚に収まらなければ, 分けて撮った写真を足せます. すべての写真のチップを合わせて数えるので, 同じチップを 2 枚の写真に写さないでください. 色が違うチップは, 確認画像のそのチップ (右の色の名前か, 同じ高さの画像) を押すと直せます. 拡大して押すこともできます.",
      }),
      status,
      header,
      list,
    ]),
    dispose: () => {
      isDisposed = true;
      photos.length = 0;
      list.replaceChildren();
    },
  };
}

/** 選んだ写真を順に解析するときに使うもの. */
interface AnalyzeFilesContext {
  /** あと何枚足せるか. */
  roomLeft(): number;
  /** 部品が画面から外されたか. 外されたら解析をやめる. */
  isDisposed(): boolean;
  /** 解析できた写真を受ける. 画像は受けた側が描いてから手放す. */
  onAnalyzed(analysis: Analysis): void;
  /** 解析の間, ボタンを押せなくする. */
  setBusy: (isBusy: boolean) => void;
  /** 解析の様子を出す欄. */
  status: HTMLElement;
}

// 選んだ写真を 1 枚ずつ解析する. 解析は画面を止めてメモリも多く使うので, 同時には行わない.
// 読めない写真は足さずに理由を出し, 残りの写真の解析は続ける.
async function analyzeFiles(
  files: File[],
  context: AnalyzeFilesContext,
): Promise<void> {
  const { status } = context;
  const accepted = files.slice(0, Math.max(0, context.roomLeft()));
  const messages: string[] = [];
  if (accepted.length < files.length) {
    messages.push(
      `写真は ${String(MAX_PHOTOS)} 枚までです. ${String(files.length - accepted.length)} 枚は足しませんでした.`,
    );
  }
  context.setBusy(true);
  status.className = "";
  for (const [index, file] of accepted.entries()) {
    const progress =
      accepted.length > 1
        ? ` (${String(index + 1)}/${String(accepted.length)} 枚目)`
        : "";
    status.textContent = `解析中${progress}… (初めては検出の仕組みの読み込みに時間がかかります)`;
    const analysis = await analyzeImage(file);
    if (context.isDisposed()) {
      if (analysis.ok) {
        analysis.value.image.close();
      }
      return;
    }
    if (analysis.ok) {
      context.onAnalyzed(analysis.value);
    } else {
      const which =
        accepted.length > 1 ? `選んだ ${String(index + 1)} 枚目: ` : "";
      messages.push(`${which}${analysis.reason}`);
    }
  }
  context.setBusy(false);
  status.className = messages.length > 0 ? "error" : "";
  status.textContent = messages.join(" ");
}

/** 写真ごとの表示を作るときに使うもの. */
interface PhotoViewOptions {
  /** 写真の一覧. 表示をこの末尾に足す. */
  list: HTMLElement;
  /** 表示の下に出すもの. */
  footer: HTMLElement | undefined;
  /** 「この写真を外す」を押したとき. */
  onRemove: () => void;
  /** チップの色を直した, または元に戻した (color が null) とき. */
  onColorChange: (position: ChipPosition, color: ChipColorName | null) => void;
}

// 1 枚の写真の表示を, 一覧の末尾に足す. 開閉でき, 見出しに写真の番号と枚数を出す. 閉じても何枚と数えたかが分かるようにするため.
// 描き終えたら画像を手放す. 画像は大きい (12MP で約 48MB) ので, 複数枚を持つとメモリが足りなくなるため.
function renderPhoto(analysis: Analysis, options: PhotoViewOptions): Photo {
  const { image, result } = analysis;
  const title = element("span");
  const removeButton = element("button", {
    text: "この写真を外す",
    attributes: { type: "button" },
  });
  removeButton.addEventListener("click", options.onRemove);
  const body = element("div", { className: "photo-body" }, [removeButton]);
  const view = element("details", { className: "photo" }, [
    element("summary", {}, [title]),
    body,
  ]);
  view.open = true;
  // 画像の幅を枠の内側に合わせるため, 一覧に入れてから幅を測って描く.
  options.list.append(view);
  const width = body.clientWidth || FALLBACK_WIDTH;
  const summary = renderResultSummary(
    image,
    result,
    width,
    options.onColorChange,
  );
  body.append(renderResultImage(image, result, width), summary.container);
  if (options.footer !== undefined) {
    body.append(options.footer);
  }
  image.close();
  return {
    detected: result,
    corrections: NO_CORRECTIONS,
    view,
    title,
    summary,
  };
}

// すべての写真の, 直した色を当てた結果で, 写真の一覧の上に出すものを作る.
function renderPhotosHeader(
  photos: readonly Photo[],
  options: ChipAnalysisOptions,
): HTMLElement {
  const corrected = photos.map((photo) =>
    applyColorCorrections(photo.detected, photo.corrections),
  );
  const correctedChipCount = photos.reduce(
    (sum, photo) => sum + countCorrectedChips(photo.corrections),
    0,
  );
  return options.renderHeader(corrected, correctedChipCount);
}

// 「写真 2: スタック 3 つ, 25 枚」. 数えられなかったスタックや, 色を直したチップがあれば, そのことも書く.
// 閉じても直したことが分かるようにするため.
function describePhoto(photoNumber: number, photo: Photo): string {
  const result = photo.detected;
  const counted = result.stacks.reduce(
    (sum, stack) => sum + (stack.count ?? 0),
    0,
  );
  const hasUncounted = result.stacks.some((stack) => stack.count === null);
  const correctedCount = countCorrectedChips(photo.corrections);
  const notes = [
    ...(hasUncounted ? ["数えられないスタックあり"] : []),
    ...(correctedCount > 0
      ? [`色を直したチップ ${String(correctedCount)} 枚`]
      : []),
  ];
  const detail =
    result.stacks.length === 0
      ? "チップの山が見つかりません"
      : `スタック ${String(result.stacks.length)} つ, ${String(counted)} 枚${notes.length > 0 ? ` (${notes.join(", ")})` : ""}`;
  return `写真 ${String(photoNumber)}: ${detail}`;
}

/** 撮影と写真の選択のボタン. */
interface ImagePickers {
  container: HTMLElement;
  /** 解析の間, ボタンを押せなくする. */
  setBusy: (isBusy: boolean) => void;
  /** 今の写真の枚数を伝える. ボタンの文字と, 上限に達したかを変える. */
  setPhotoCount: (count: number) => void;
}

// 撮影と写真の選択の 2 つのボタン. ファイルの欄は隠し, ボタンから開く.
function renderImagePickers(onPicked: (files: File[]) => void): ImagePickers {
  const container = element("div", { className: "image-pickers" });
  // capture を付けるとカメラが開き, 付けないと写真の一覧から選べる.
  // カメラは 1 回に 1 枚しか撮れないので, 何枚も選べる (multiple) のは写真の一覧だけにする.
  const pickers = [
    { label: "撮影する", addLabel: "撮影して足す", isCamera: true },
    { label: "写真を選ぶ", addLabel: "写真を選んで足す", isCamera: false },
  ].map(({ label, addLabel, isCamera }) => {
    const input = element("input", {
      attributes: { type: "file", accept: "image/*", hidden: "" },
    });
    if (isCamera) {
      input.setAttribute("capture", "environment");
    } else {
      input.multiple = true;
    }
    const button = element("button", {
      text: label,
      attributes: { type: "button" },
    });
    button.addEventListener("click", () => {
      input.click();
    });
    input.addEventListener("change", () => {
      const files = [...(input.files ?? [])];
      // 同じ写真をもう一度選んでも change が起きるよう, 欄を空に戻す.
      input.value = "";
      if (files.length > 0) {
        onPicked(files);
      }
    });
    container.append(button, input);
    return { button, label, addLabel };
  });

  let isBusy = false;
  let isFull = false;
  const update = (): void => {
    for (const { button } of pickers) {
      button.disabled = isBusy || isFull;
    }
  };
  return {
    container,
    setBusy: (busy) => {
      isBusy = busy;
      update();
    },
    setPhotoCount: (count) => {
      isFull = count >= MAX_PHOTOS;
      for (const { button, label, addLabel } of pickers) {
        button.textContent = count === 0 ? label : addLabel;
      }
      update();
    },
  };
}

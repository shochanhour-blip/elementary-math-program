// シンプルな掛け算学習アプリ（基本仕様 + 1色対応）
// ここを拡張すれば複数色対応できる：colorMap と currentGroup の切り替え処理を追加する

const rowInput = document.getElementById("rowInput");
const colInput = document.getElementById("colInput");
const generateBtn = document.getElementById("generateBtn");
const showBtn = document.getElementById("showBtn");
const groupingBtn = document.getElementById("groupingBtn");
const swapBtn = document.getElementById("swapBtn");
const clearBtn = document.getElementById("clearBtn");
const colorPalette = document.getElementById("colorPalette");
const toggleNumbering = document.getElementById("toggleNumbering");
const colLabels = document.getElementById("colLabels");
const rowLabels = document.getElementById("rowLabels");
const gridHolder = document.getElementById("gridHolder");
const boardWrapper = document.querySelector(".board-wrapper");
const grid = document.getElementById("grid");
const overlay = document.getElementById("overlay");

// 色を追加したい場合はここに色を追加し、renderPalette が自動でボタン生成します。
// 白は除外（未選択は group=0 の扱い）。
let currentGroup = 1;
const colorMap = {
  1: "#ff6b6b", // 赤
  2: "#4e86ff", // ブルー
  3: "#34c759", // グリーン
  4: "#f5a524", // オレンジ
  5: "#9b59b6", // むらさき
  6: "#ff7ab6", // ピンク
  7: "#ffd447", // イエロー
  8: "#2bbbad", // エメラルド
  9: "#8d6e63", // ちゃ色
};

let isSelecting = false;
let activePointerId = null;
let anchorCell = null; // { row, col }
let selectionGroup = currentGroup; // ドラッグ中に適用する色（上書き・消去両対応）
let showNumbering = true;
let showGrouping = false;
let isOverlayVisible = false;
let swapFactors = false; // かけ算の表示だけ入れ替える
const ROOT_STYLE = document.documentElement.style;
const MAX_SIDE = 12; // ぎょう・れつ の上限（大きすぎると固まる・画面に入らない）
const DEFAULT_CIRCLE = 44; // px
const MIN_CIRCLE = 16;
const MAX_CIRCLE = 64;
const DEFAULT_GAP = 12;
const MIN_GAP = 4;
const MAX_GAP = 16;

// グリッド生成
function buildGrid(rows, cols) {
  adjustCircleSize(rows, cols);
  grid.innerHTML = "";
  grid.style.gridTemplateRows = `repeat(${rows}, var(--circle-size))`;
  grid.style.gridTemplateColumns = `repeat(${cols}, var(--circle-size))`;
  isSelecting = false;
  activePointerId = null;
  anchorCell = null;

  const fragment = document.createDocumentFragment();
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = document.createElement("div");
      cell.className = "circle";
      cell.textContent = ""; // シンプルな丸表示にする
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.dataset.group = "0"; // 0 は未選択
      fragment.appendChild(cell);
    }
  }
  grid.appendChild(fragment);
  overlay.innerHTML = "";
  isOverlayVisible = false;
  renderLabels(rows, cols);
  refreshControls();
}

// ビューポートに収めるために円のサイズを動的に調整
function adjustCircleSize(rows, cols) {
  const wrapperRect = boardWrapper?.getBoundingClientRect();
  const controlsRect = document.querySelector(".controls")?.getBoundingClientRect();

  // 横はコンテナ基準、縦はビュー全体からヘッダー分を差し引き、毎回一定基準で測る
  const holderWidth =
    wrapperRect?.width || gridHolder?.clientWidth || window.innerWidth;
  const headerHeight = controlsRect?.height || 0;
  const holderHeight = Math.max(
    220,
    window.innerHeight - headerHeight - 120
  );

  const usableWidth = Math.max(200, holderWidth - 20);
  const usableHeight = Math.max(220, holderHeight - 20);

  const baseTotalW = cols * DEFAULT_CIRCLE + (cols - 1) * DEFAULT_GAP;
  const baseTotalH = rows * DEFAULT_CIRCLE + (rows - 1) * DEFAULT_GAP;
  const scale = Math.min(usableWidth / baseTotalW, usableHeight / baseTotalH);

  let size = clamp(DEFAULT_CIRCLE * scale, MIN_CIRCLE, MAX_CIRCLE);
  let gap = clamp(DEFAULT_GAP * scale, MIN_GAP, MAX_GAP);

  // 再計算してはみ出しそうなら調整（拡大・縮小両対応）
  const totalW = cols * size + (cols - 1) * gap;
  const totalH = rows * size + (rows - 1) * gap;
  const fixScale = Math.min(usableWidth / totalW, usableHeight / totalH);
  size = clamp(size * fixScale, MIN_CIRCLE, MAX_CIRCLE);
  gap = clamp(gap * fixScale, MIN_GAP, MAX_GAP);

  ROOT_STYLE.setProperty("--circle-size", `${size}px`);
  ROOT_STYLE.setProperty("--grid-gap", `${gap}px`);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// セルに色を塗る（group=0 なら未選択扱い）
function paintCell(cell, group) {
  cell.dataset.group = String(group);
  if (group === 0) {
    cell.style.background = "#fff";
    cell.style.color = "#5b6470";
    cell.style.borderColor = "#e1e7f0";
    return;
  }
  const color = colorMap[group];
  cell.style.background = color;
  cell.style.color = "#fff";
  cell.style.borderColor = color;
}

// 選択開始
function handlePointerDown(e) {
  const target = e.target;
  if (!target.classList.contains("circle")) return;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  // 消しゴムを選んでいるときは常に消す。
  // それ以外は、既に色がついている丸から引き始めたら「消すドラッグ」に切り替える
  selectionGroup =
    currentGroup === 0 ? 0 : target.dataset.group === "0" ? currentGroup : 0;
  isSelecting = true;
  activePointerId = e.pointerId;
  target.setPointerCapture(activePointerId);
  anchorCell = { row, col };
  applyRectSelection(row, col, selectionGroup);
}

// ドラッグ中（範囲選択）
function handlePointerMove(e) {
  if (!isSelecting) return;
  if (e.pointerId !== activePointerId) return;
  const pointTarget = document.elementFromPoint(e.clientX, e.clientY);
  const cell = pointTarget?.classList.contains("circle")
    ? pointTarget
    : pointTarget?.closest(".circle");
  if (!cell || !anchorCell) return;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  applyRectSelection(row, col, selectionGroup);
}

// 選択終了
function handlePointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  isSelecting = false;
  activePointerId = null;
  anchorCell = null;
}

// 矩形範囲を現在色で塗る
function applyRectSelection(targetRow, targetCol, group) {
  if (!anchorCell) return;
  const startRow = anchorCell.row;
  const startCol = anchorCell.col;
  const minRow = Math.min(startRow, targetRow);
  const maxRow = Math.max(startRow, targetRow);
  const minCol = Math.min(startCol, targetCol);
  const maxCol = Math.max(startCol, targetCol);

  const cells = grid.querySelectorAll(".circle");
  cells.forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
      paintCell(cell, group);
    }
  });

  refreshControls();
}

// パレット生成
function renderPalette() {
  colorPalette.innerHTML = "";

  // 消しゴム（group=0）。色をぬった丸からドラッグしないと消せないのは分かりにくいので明示する
  const eraser = document.createElement("button");
  eraser.type = "button";
  eraser.className = "color-swatch eraser";
  eraser.dataset.group = "0";
  eraser.setAttribute("aria-label", "いろを けす");
  eraser.title = "いろを けす";
  if (currentGroup === 0) eraser.classList.add("selected");
  eraser.addEventListener("click", () => {
    currentGroup = 0;
    updatePaletteSelection();
  });
  colorPalette.appendChild(eraser);

  Object.entries(colorMap).forEach(([group, color], idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-swatch";
    btn.style.background = color;
    btn.dataset.group = group;
    btn.setAttribute("aria-label", `色 ${idx + 1}`);
    if (Number(group) === currentGroup) {
      btn.classList.add("selected");
    }
    btn.addEventListener("click", () => {
      currentGroup = Number(group);
      updatePaletteSelection();
    });
    colorPalette.appendChild(btn);
  });
}

function updatePaletteSelection() {
  const buttons = colorPalette.querySelectorAll(".color-swatch");
  buttons.forEach((btn) => {
    const group = Number(btn.dataset.group);
    if (group === currentGroup) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });
}

// 透明度付きカラーを生成（#rrggbb, alpha: 0-1）
function withAlpha(hex, alpha) {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 同じ色でも「つながっているかたまり」ごとに分ける。
// 色だけでまとめると、離れた2か所を同じ色で塗ったときに
// 外接矩形が実際より大きくなり「4 × 4 = 5」のような誤った式が出てしまう。
// 色を暗くする（白い式ボックスの枠に使う。黄色などでも読める濃さにする）
function darken(hex, ratio) {
  const v = hex.replace("#", "");
  const mix = (c) => Math.round(parseInt(c, 16) * (1 - ratio));
  const r = mix(v.slice(0, 2));
  const g = mix(v.slice(2, 4));
  const b = mix(v.slice(4, 6));
  return `rgb(${r}, ${g}, ${b})`;
}

// かたまりの中で いちばん大きい長方形をさがす。
// 「3 × 3 + 1」のように、長方形の部分と のこりに分けて式にするために使う
function largestRectangle(cells, minRow, maxRow, minCol, maxCol) {
  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;
  const cols = new Array(width).fill(0);
  let best = { area: 0, r1: 0, c1: 0, r2: 0, c2: 0 };

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      cols[c] = cells.has(`${minRow + r},${minCol + c}`) ? cols[c] + 1 : 0;
    }
    // その行までの「柱の高さ」から最大長方形を求める（スタック法）
    const stack = [];
    for (let c = 0; c <= width; c++) {
      const h = c === width ? 0 : cols[c];
      let start = c;
      while (stack.length && stack[stack.length - 1].h >= h) {
        const top = stack.pop();
        const area = top.h * (c - top.i);
        if (area > best.area) {
          best = {
            area,
            r1: minRow + r - top.h + 1,
            r2: minRow + r,
            c1: minCol + top.i,
            c2: minCol + c - 1,
          };
        }
        start = top.i;
      }
      stack.push({ i: start, h });
    }
  }
  return best;
}

// 分解して式にする価値があるか。
// 長方形が小さすぎる（1こだけ／全体の半分未満）ときは、こ数だけ出したほうが分かりやすい
function isUsefulRect(rect, total) {
  return rect.area >= 2 && rect.area >= total / 2;
}

// かこいを描く。1列（入れ替え時は1行）ずつのブロックで囲う
function appendOutlines(startRow, startCol, rowCount, colCount, geom) {
  const { circleSize, gap, offsetLeft, offsetTop } = geom;
  const cellSpan = circleSize + gap;
  const blocks = swapFactors ? rowCount : colCount;

  for (let i = 0; i < blocks; i++) {
    const outline = document.createElement("div");
    outline.className = "overlay-group";
    if (!swapFactors) {
      outline.style.left = `${offsetLeft + (startCol - 1) * cellSpan + i * cellSpan}px`;
      outline.style.top = `${offsetTop + (startRow - 1) * cellSpan}px`;
      outline.style.width = `${circleSize}px`;
      outline.style.height = `${rowCount * circleSize + (rowCount - 1) * gap}px`;
    } else {
      outline.style.left = `${offsetLeft + (startCol - 1) * cellSpan}px`;
      outline.style.top = `${offsetTop + (startRow - 1) * cellSpan + i * cellSpan}px`;
      outline.style.width = `${colCount * circleSize + (colCount - 1) * gap}px`;
      outline.style.height = `${circleSize}px`;
    }
    overlay.appendChild(outline);
  }
}

// 式ボックスの文字サイズ。丸の大きさに合わせて基準を決め、
// かたまりの領域からはみ出す場合は収まるまで縮める
const FORMULA_MIN_FONT = 12;
function fitFormulaBox(box, maxW, maxH, circleSize) {
  let font = clamp(circleSize * 0.66, 16, 36);
  box.style.fontSize = `${font}px`;

  // padding や角丸は em 指定なので、文字サイズを変えれば全体が相似で縮む
  for (let i = 0; i < 4; i++) {
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    if (w <= maxW && h <= maxH) break;
    const next = Math.max(FORMULA_MIN_FONT, font * Math.min(maxW / w, maxH / h));
    if (next >= font - 0.2) {
      font = next;
      box.style.fontSize = `${font}px`;
      break; // これ以上小さくできない（下限に到達）
    }
    font = next;
    box.style.fontSize = `${font}px`;
  }
}

function collectClusters() {
  const cells = Array.from(grid.querySelectorAll(".circle"));
  const byPos = new Map();
  cells.forEach((cell) => {
    byPos.set(`${cell.dataset.row},${cell.dataset.col}`, cell);
  });

  const seen = new Set();
  const clusters = [];

  cells.forEach((cell) => {
    const group = Number(cell.dataset.group);
    if (group === 0) return;
    const startKey = `${cell.dataset.row},${cell.dataset.col}`;
    if (seen.has(startKey)) return;

    const entry = { group, rows: new Set(), cols: new Set(), cells: new Set(), count: 0 };
    const stack = [startKey];
    seen.add(startKey);

    while (stack.length) {
      const key = stack.pop();
      const cur = byPos.get(key);
      const row = Number(cur.dataset.row);
      const col = Number(cur.dataset.col);
      entry.rows.add(row);
      entry.cols.add(col);
      entry.cells.add(key);
      entry.count += 1;

      // 上下左右の4方向だけをつながりとみなす（ななめは別のかたまり）
      const around = [
        [row - 1, col], [row + 1, col],
        [row, col - 1], [row, col + 1],
      ];
      around.forEach(([r, c]) => {
        const k = `${r},${c}`;
        if (seen.has(k)) return;
        const nb = byPos.get(k);
        if (!nb || Number(nb.dataset.group) !== group) return;
        seen.add(k);
        stack.push(k);
      });
    }
    clusters.push(entry);
  });

  return clusters;
}

function renderLabels(rows, cols) {
  colLabels.innerHTML = "";
  rowLabels.innerHTML = "";

  if (!showNumbering) {
    colLabels.style.display = "none";
    rowLabels.style.display = "none";
    return;
  }

  colLabels.style.display = "grid";
  rowLabels.style.display = "grid";
  colLabels.style.gridTemplateColumns = `repeat(${cols}, var(--circle-size))`;
  rowLabels.style.gridTemplateRows = `repeat(${rows}, var(--circle-size))`;

  for (let c = 1; c <= cols; c++) {
    const cell = document.createElement("div");
    cell.className = "label-cell";
    cell.textContent = c;
    colLabels.appendChild(cell);
  }
  for (let r = 1; r <= rows; r++) {
    const cell = document.createElement("div");
    cell.className = "label-cell";
    cell.textContent = r;
    rowLabels.appendChild(cell);
  }
}

// かけ算を計算してオーバーレイ表示
function updateShowButtonLabel() {
  showBtn.textContent = isOverlayVisible ? "かけ算を けす" : "かけ算を ひょうじ";
  showBtn.classList.toggle("is-on", isOverlayVisible);
  updateSwapAvailability();
}

function updateGroupingButtonLabel() {
  groupingBtn.textContent = showGrouping ? "かこいを けす" : "かこいを ひょうじ";
  groupingBtn.classList.toggle("is-on", showGrouping);
  updateSwapAvailability();
}

function updateSwapButtonLabel() {
  swapBtn.textContent = swapFactors ? "いれかえを もどす" : "いれかえる";
  swapBtn.classList.toggle("is-on", swapFactors);
  updateSwapAvailability();
}

// 「いれかえる」は式かかこいが出ているときだけ意味がある。
// どちらも出ていないときは押せなくして、理由をツールチップで伝える
// ボタンの有効・無効を切り替える。
// 使えない間はツールチップが出ないブラウザが多いので、
// 「いま使えるようになった」瞬間を軽い明滅で伝える
function setBtnEnabled(btn, usable, hint) {
  const wasUsable = btn.dataset.usable;
  btn.disabled = !usable;
  btn.title = usable ? "" : hint;
  if (wasUsable === "0" && usable) {
    btn.classList.remove("just-enabled");
    void btn.offsetWidth;
    btn.classList.add("just-enabled");
    setTimeout(() => btn.classList.remove("just-enabled"), 700);
  }
  btn.dataset.usable = usable ? "1" : "0";
}

function updateSwapAvailability() {
  setBtnEnabled(
    swapBtn,
    isOverlayVisible || showGrouping,
    "「かけ算を ひょうじ」か「かこいを ひょうじ」を おすと つかえます"
  );
}

function hasAnyColor() {
  return Array.from(grid.querySelectorAll(".circle")).some(
    (cell) => cell.dataset.group !== "0"
  );
}

// いろが1つも塗られていないときは、表示するものも消すものも無い。
// 表示中の状態を解除したうえで、3つのボタンをまとめて使えなくする
function refreshControls() {
  const painted = hasAnyColor();
  if (!painted && (isOverlayVisible || showGrouping)) {
    overlay.innerHTML = "";
    isOverlayVisible = false;
    showGrouping = false;
  }
  const hint = "まるに いろを ぬると つかえます";
  setBtnEnabled(showBtn, painted, hint);
  setBtnEnabled(groupingBtn, painted, hint);
  updateShowButtonLabel();
  updateGroupingButtonLabel();
}

// いろを全部消す（ならびはそのまま）
function clearColors() {
  grid.querySelectorAll(".circle").forEach((cell) => paintCell(cell, 0));
  refreshControls(); // 白紙になるので表示状態を解除してボタンも無効化される
}

function toggleMultiplication() {
  if (isOverlayVisible) {
    overlay.innerHTML = "";
    isOverlayVisible = false;
    updateShowButtonLabel();
    // かけ算を消した後でも、かこい表示がONなら枠だけ描画
    if (showGrouping) {
      renderGroupingOverlayOnly();
    }
    return;
  }

  renderMultiplicationOverlay();
}

function renderMultiplicationOverlay() {
  overlay.innerHTML = "";
  const clusters = collectClusters();

  if (clusters.length === 0) {
    const msg = document.createElement("div");
    msg.className = "overlay-box";
    msg.style.left = "50%";
    msg.style.top = "18px";
    msg.textContent = "まだ いろがついた まる が ありません";
    overlay.appendChild(msg);
    isOverlayVisible = true;
    updateShowButtonLabel();
    return;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const circleSize = parseFloat(rootStyle.getPropertyValue("--circle-size")) || 0;
  const gap = parseFloat(rootStyle.getPropertyValue("--grid-gap")) || 0;
  const overlayRect = overlay.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  const offsetLeft = gridRect.left - overlayRect.left;
  const offsetTop = gridRect.top - overlayRect.top;

  const geom = { circleSize, gap, offsetLeft, offsetTop };

  // 囲みの線が式の文字を横切らないよう、式ボックスは最後にまとめて重ねる
  const formulaBoxes = [];

  clusters.forEach((entry) => {
    const group = entry.group;
    const minRow = Math.min(...entry.rows);
    const maxRow = Math.max(...entry.rows);
    const minCol = Math.min(...entry.cols);
    const maxCol = Math.max(...entry.cols);
    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
    // 表示用の因数（表示のみ入れ替え）
    const dispRowCount = swapFactors ? colCount : rowCount;
    const dispColCount = swapFactors ? rowCount : colCount;
    const centerRow = (minRow + maxRow) / 2;
    const centerCol = (minCol + maxCol) / 2;
    const centerX =
      offsetLeft +
      (centerCol - 1) * (circleSize + gap) +
      circleSize / 2;
    const centerY =
      offsetTop +
      (centerRow - 1) * (circleSize + gap) +
      circleSize / 2;

    // ながしかく（すき間なく全部うまっている）かどうか。
    // 欠けているかたまりに「7 × 3 = 22」のような成り立たない式を出さないための判定
    const isRectangle = entry.count === rowCount * colCount;
    const edgeColor = colorMap[group] ? darken(colorMap[group], 0.35) : "#555";

    // ながしかくでない場合は「いちばん大きい長方形 ＋ のこり」に分けて式にする
    const rect = isRectangle
      ? null
      : largestRectangle(entry.cells, minRow, maxRow, minCol, maxCol);
    const canDecompose = rect ? isUsefulRect(rect, entry.count) : false;

    const box = document.createElement("div");
    box.className = "overlay-box";
    box.style.left = `${centerX}px`;
    box.style.top = `${centerY}px`;
    // 中は白。うしろの丸がうっすら見えるくらいの透け具合にする
    box.style.background = "rgba(255, 255, 255, 0.88)";
    box.style.color = "#1f2933";
    // 枠はそのかたまりの色（濃いめ）。どの式がどのかたまりのものか分かるようにする
    box.style.border = `3px ${isRectangle ? "solid" : "dashed"} ${edgeColor}`;

    if (canDecompose) {
      // 例: 3 × 3 + 1 = 10
      const rectRows = rect.r2 - rect.r1 + 1;
      const rectCols = rect.c2 - rect.c1 + 1;
      const a = swapFactors ? rectCols : rectRows;
      const b = swapFactors ? rectRows : rectCols;
      const rest = entry.count - rect.area;
      box.textContent = `${a} × ${b} + ${rest} = ${entry.count}`;
      box.style.display = "block";
      box.style.padding = ".28em .5em";
      box.title = "ながしかくの ぶんと のこりに わけた しきです";
    } else if (!isRectangle) {
      // 長方形の部分が小さすぎて分けても分かりにくいので、数だけ伝える
      box.textContent = `${entry.count}こ`;
      box.style.display = "block";
      box.style.padding = ".28em .5em";
      box.title = "ながしかくに ならべると かけ算の しきが でます";
    } else if (rowCount >= colCount * 1.2) {
      // 縦長: 縦積みで表示
      box.innerHTML = `${dispRowCount}<br>×<br>${dispColCount}<br>=<br>${entry.count}`;
      box.style.display = "flex";
      box.style.flexDirection = "column";
      box.style.alignItems = "center";
      box.style.justifyContent = "center";
      box.style.padding = ".34em .5em";
    } else {
      // 横長・ほぼ正方: 横書き
      box.textContent = `${dispRowCount} × ${dispColCount} = ${entry.count}`;
      box.style.display = "block";
      box.style.padding = ".28em .5em";
    }

    // かたまりが占める領域。ここに収まるまで文字サイズを詰める
    const clusterW = colCount * circleSize + (colCount - 1) * gap;
    const clusterH = rowCount * circleSize + (rowCount - 1) * gap;
    overlay.appendChild(box); // 実寸を測るため一度置く
    fitFormulaBox(box, clusterW, clusterH, circleSize);
    formulaBoxes.push(box);

    // かこい描画。ながしかくでない場合は「長方形の部分」だけを囲う
    if (showGrouping) {
      if (isRectangle) {
        appendOutlines(minRow, minCol, rowCount, colCount, geom);
      } else if (canDecompose) {
        appendOutlines(
          rect.r1, rect.c1,
          rect.r2 - rect.r1 + 1, rect.c2 - rect.c1 + 1,
          geom
        );
      }
    }
  });

  // 囲みをすべて描いたあとで式を重ね直す（appendChild は移動になる）
  formulaBoxes.forEach((box) => overlay.appendChild(box));

  isOverlayVisible = true;
  updateShowButtonLabel();
}

// かこいのみを描画（かけ算ボックスは出さない）
function renderGroupingOverlayOnly() {
  overlay.innerHTML = "";
  const clusters = collectClusters();
  if (clusters.length === 0) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const circleSize = parseFloat(rootStyle.getPropertyValue("--circle-size")) || 0;
  const gap = parseFloat(rootStyle.getPropertyValue("--grid-gap")) || 0;
  const overlayRect = overlay.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  const offsetLeft = gridRect.left - overlayRect.left;
  const offsetTop = gridRect.top - overlayRect.top;

  const geom = { circleSize, gap, offsetLeft, offsetTop };

  clusters.forEach((entry) => {
    const minRow = Math.min(...entry.rows);
    const maxRow = Math.max(...entry.rows);
    const minCol = Math.min(...entry.cols);
    const maxCol = Math.max(...entry.cols);
    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;

    if (entry.count === rowCount * colCount) {
      appendOutlines(minRow, minCol, rowCount, colCount, geom);
      return;
    }
    // ながしかくでない場合は、式と同じ「長方形の部分」だけを囲う
    const rect = largestRectangle(entry.cells, minRow, maxRow, minCol, maxCol);
    if (!isUsefulRect(rect, entry.count)) return;
    appendOutlines(
      rect.r1, rect.c1,
      rect.r2 - rect.r1 + 1, rect.c2 - rect.c1 + 1,
      geom
    );
  });
}

// イベント設定
// 入力値を 1〜MAX_SIDE に収める。入力欄にも書き戻して、直された数が見えるようにする
function readSide(input) {
  const n = clamp(Math.round(Number(input.value) || 1), 1, MAX_SIDE);
  input.value = String(n);
  return n;
}

function generate() {
  buildGrid(readSide(rowInput), readSide(colInput));
}

generateBtn.addEventListener("click", generate);

// 数を入れて Enter でも作れるようにする
[rowInput, colInput].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    generate();
  });
});

showBtn.addEventListener("click", () => {
  if (showBtn.disabled) return;
  toggleMultiplication();
});

groupingBtn.addEventListener("click", () => {
  if (groupingBtn.disabled) return;
  showGrouping = !showGrouping;
  updateGroupingButtonLabel();
  if (isOverlayVisible) {
    renderMultiplicationOverlay();
  } else {
    if (showGrouping) {
      renderGroupingOverlayOnly();
    } else {
      overlay.innerHTML = "";
    }
  }
});

swapBtn.addEventListener("click", () => {
  if (swapBtn.disabled) return;
  swapFactors = !swapFactors; // 配置は変えず式だけ入れ替える
  updateSwapButtonLabel();    // 式が出ていなくても押したことが分かるようにする
  if (isOverlayVisible) {
    renderMultiplicationOverlay();
  } else if (showGrouping) {
    renderGroupingOverlayOnly(); // かこいの向きも swapFactors で変わる
  }
});

clearBtn.addEventListener("click", clearColors);

// swap 状態を切り替えた場合でも、次に「かけざんを ひょうじ」を押したときは反映される
// →renderMultiplicationOverlay 内で swapFactors を参照するのでここでは何もしない

grid.addEventListener("pointerdown", handlePointerDown);
grid.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("pointercancel", handlePointerUp);

toggleNumbering.addEventListener("change", () => {
  showNumbering = toggleNumbering.checked;
  renderLabels(readSide(rowInput), readSide(colInput));
});

// 画面サイズ変更時にも円サイズを再計算。
// オーバーレイ（式・かこい）は px 直打ちなので、必ず描き直さないとズレたまま残る
let resizeTimer = null;
function relayout() {
  adjustCircleSize(readSide(rowInput), readSide(colInput));
  if (isOverlayVisible) {
    renderMultiplicationOverlay();
  } else if (showGrouping) {
    renderGroupingOverlayOnly();
  }
}
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(relayout, 120);
});
window.addEventListener("orientationchange", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(relayout, 250);
});

// 初期表示
generate();
renderPalette();
updateSwapButtonLabel();


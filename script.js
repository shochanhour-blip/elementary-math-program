// シンプルな掛け算学習アプリ（基本仕様 + 1色対応）
// ここを拡張すれば複数色対応できる：colorMap と currentGroup の切り替え処理を追加する

const rowInput = document.getElementById("rowInput");
const colInput = document.getElementById("colInput");
const generateBtn = document.getElementById("generateBtn");
const showBtn = document.getElementById("showBtn");
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
const ROOT_STYLE = document.documentElement.style;
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
  renderLabels(rows, cols);
}

// ビューポートに収めるために円のサイズを動的に調整
function adjustCircleSize(rows, cols) {
  const holderWidth = gridHolder?.clientWidth || boardWrapper?.clientWidth || window.innerWidth;
  const holderHeight = boardWrapper?.clientHeight || window.innerHeight * 0.6;

  const usableWidth = Math.max(160, holderWidth - 32); // ラベルや余白を考慮して少し控えめに
  const usableHeight = Math.max(180, holderHeight - 80);

  const baseTotalW = cols * DEFAULT_CIRCLE + (cols - 1) * DEFAULT_GAP;
  const baseTotalH = rows * DEFAULT_CIRCLE + (rows - 1) * DEFAULT_GAP;
  const scale =
    Math.min(1, usableWidth / baseTotalW, usableHeight / baseTotalH);

  let size = clamp(DEFAULT_CIRCLE * scale, MIN_CIRCLE, MAX_CIRCLE);
  let gap = clamp(DEFAULT_GAP * scale, MIN_GAP, MAX_GAP);

  // 再計算してはみ出しそうならもう一度縮小
  const totalW = cols * size + (cols - 1) * gap;
  const totalH = rows * size + (rows - 1) * gap;
  const fixScale = Math.min(1, usableWidth / totalW, usableHeight / totalH);
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
  // もし既に色がついていたら白に戻すドラッグに切り替える
  selectionGroup = target.dataset.group === "0" ? currentGroup : 0;
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
}

// パレット生成
function renderPalette() {
  colorPalette.innerHTML = "";
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

function collectGroups() {
  const cells = Array.from(grid.querySelectorAll(".circle"));
  const groups = new Map();

  cells.forEach((cell) => {
    const group = Number(cell.dataset.group);
    if (group === 0) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (!groups.has(group)) {
      groups.set(group, {
        rows: new Set(),
        cols: new Set(),
        count: 0,
      });
    }
    const entry = groups.get(group);
    entry.rows.add(row);
    entry.cols.add(col);
    entry.count += 1;
  });
  return groups;
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
function showMultiplication() {
  overlay.innerHTML = "";
  const groups = collectGroups();

  if (groups.size === 0) {
    const msg = document.createElement("div");
    msg.className = "overlay-box";
    msg.style.left = "50%";
    msg.style.top = "18px";
    msg.textContent = "まだ色がついた◯がありません";
    overlay.appendChild(msg);
    return;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const circleSize = parseFloat(rootStyle.getPropertyValue("--circle-size")) || 0;
  const gap = parseFloat(rootStyle.getPropertyValue("--grid-gap")) || 0;
  const overlayRect = overlay.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  const offsetLeft = gridRect.left - overlayRect.left;
  const offsetTop = gridRect.top - overlayRect.top;

  groups.forEach((entry, group) => {
    const minRow = Math.min(...entry.rows);
    const maxRow = Math.max(...entry.rows);
    const minCol = Math.min(...entry.cols);
    const maxCol = Math.max(...entry.cols);
    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
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

    const box = document.createElement("div");
    box.className = "overlay-box";
    box.textContent = `${rowCount} × ${colCount} = ${entry.count}`;
    box.style.left = `${centerX}px`;
    box.style.top = `${centerY}px`;
    const bg = colorMap[group] ? withAlpha(colorMap[group], 0.22) : "rgba(0,0,0,0.18)";
    box.style.background = bg;
    box.style.color = "#2b2b2b";
    box.style.border = `2px solid ${colorMap[group] || "transparent"}`;

    overlay.appendChild(box);
  });
}

// イベント設定
generateBtn.addEventListener("click", () => {
  const rows = Math.max(1, Number(rowInput.value) || 1);
  const cols = Math.max(1, Number(colInput.value) || 1);
  buildGrid(rows, cols);
});

showBtn.addEventListener("click", showMultiplication);

grid.addEventListener("pointerdown", handlePointerDown);
grid.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("pointercancel", handlePointerUp);

toggleNumbering.addEventListener("change", () => {
  showNumbering = toggleNumbering.checked;
  const rows = Math.max(1, Number(rowInput.value) || 1);
  const cols = Math.max(1, Number(colInput.value) || 1);
  renderLabels(rows, cols);
});

// 初期表示
buildGrid(Number(rowInput.value), Number(colInput.value));
renderPalette();


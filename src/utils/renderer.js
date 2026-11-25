import { Application, Container, Graphics, Text } from 'pixi.js';
import {
  DEFAULT_CONTROLS,
  DEFAULT_SETTINGS,
  subscribeSettings,
} from '../UI/Config';

const MIN_NEXT_COUNT = 1;
const MAX_NEXT_COUNT = 5;

const CONTROLS = { ...DEFAULT_CONTROLS };

const CONTROL_ROWS = [
  { action: 'moveLeft', shortLabel: 'IZQ' },
  { action: 'moveRight', shortLabel: 'DER' },
  { action: 'rotateCW', shortLabel: 'ROT +' },
  { action: 'rotateCCW', shortLabel: 'ROT -' },
  { action: 'softDrop', shortLabel: 'S.DROP' },
  { action: 'hardDrop', shortLabel: 'H.DROP' },
  { action: 'hold', shortLabel: 'HOLD' },
  { action: 'reset', shortLabel: 'RESET' },
  { action: 'pause', shortLabel: 'PAUSA' },
];

function formatKeyForCanvas(key) {
  if (!key || typeof key !== 'string') return '-';
  const k = key.toLowerCase();
  if (k === ' ') return 'SPC';
  if (k === 'arrowleft') return '←';
  if (k === 'arrowright') return '→';
  if (k === 'arrowup') return '↑';
  if (k === 'arrowdown') return '↓';
  if (k === 'control') return 'CTRL';
  if (k === 'shift') return 'SHF';
  return k.length > 4 ? k.slice(0, 4).toUpperCase() : k.toUpperCase();
}

function clampNextCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 4;
  return Math.min(MAX_NEXT_COUNT, Math.max(MIN_NEXT_COUNT, Math.round(num)));
}

function toPixiColor(color, fallback = 0xffffff) {
  if (typeof color === 'number' && Number.isFinite(color)) return color;
  if (typeof color === 'string') {
    let clean = color.trim().toLowerCase();
    if (clean.startsWith('#')) {
      clean = clean.slice(1);
    }
    // Expandir hex corto de 3 dígitos (#fff -> ffffff)
    if (/^[0-9a-f]{3}$/i.test(clean)) {
      clean = clean
        .split('')
        .map((ch) => ch + ch)
        .join('');
    }
    if (/^[0-9a-f]{6}$/i.test(clean)) {
      const parsed = Number.parseInt(clean, 16);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

/**
 * Resuelve el color de la pieza para el render:
 * - Si es pieza fantasma (isGhost) o el neón está activo, devuelve blanco (0xffffff).
 * - Si el neón está inactivo, usa el color recibido.
 */
function resolvePieceColor(
  color,
  { pieceType = null, neonEnabled = false, isGhost = false } = {}
) {
  if (isGhost || neonEnabled) {
    return 0xffffff;
  }

  return toPixiColor(color, 0xffffff);
}

function getShapeBounds(shape) {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  shape.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      if (val !== 0) {
        if (rIdx < minRow) minRow = rIdx;
        if (rIdx > maxRow) maxRow = rIdx;
        if (cIdx < minCol) minCol = cIdx;
        if (cIdx > maxCol) maxCol = cIdx;
      }
    });
  });

  if (minRow === Infinity) {
    return { widthCells: 0, heightCells: 0, minRow: 0, minCol: 0 };
  }

  return {
    minRow,
    minCol,
    widthCells: maxCol - minCol + 1,
    heightCells: maxRow - minRow + 1,
  };
}

/**
 * Dibuja un bloque con estilo clásico o tubo/panel de neón limpio y contenido dentro de la celda.
 */
function drawBlock(
  graphics,
  x,
  y,
  size,
  color,
  {
    alpha = 1,
    isGhost = false,
    isTopoutPreview = false,
    neonEnabled = false,
    pieceType = null,
  } = {}
) {
  if (isTopoutPreview) {
    graphics.rect(x, y, size, size);
    graphics.fill({ color: 0xff2a2a, alpha: 0.35 * alpha });
    graphics.stroke({ color: 0xff2a2a, width: 1.5, alpha: 0.9 * alpha });
    return;
  }

  const resolvedColor = resolvePieceColor(color, {
    pieceType,
    neonEnabled,
    isGhost,
  });

  if (neonEnabled) {
    const cellInset = Math.max(1, Math.round(size * 0.05));
    const bx = x + cellInset;
    const by = y + cellInset;
    const bw = Math.max(4, size - cellInset * 2);
    const bh = Math.max(4, size - cellInset * 2);
    const radius = Math.max(2, Math.min(5, Math.round(bw * 0.16)));

    if (isGhost) {
      graphics.roundRect(bx + 1, by + 1, bw - 2, bh - 2, radius);
      graphics.stroke({ color: 0xffffff, width: 1.5, alpha: 0.75 });
      return;
    }

    // Base oscura para contraste limpio del neón
    graphics.roundRect(bx, by, bw, bh, radius);
    graphics.fill({ color: 0x0b1020, alpha: 0.92 * alpha });

    // Tinte saturado moderado en el interior
    graphics.roundRect(bx, by, bw, bh, radius);
    graphics.fill({ color: resolvedColor, alpha: 0.24 * alpha });

    // Reflejo interno sutil superior-izquierdo
    const innerPad = Math.max(2, Math.round(bw * 0.18));
    if (bw - innerPad * 2 >= 3 && bh - innerPad * 2 >= 3) {
      graphics.roundRect(
        bx + innerPad,
        by + innerPad,
        bw - innerPad * 2,
        bh - innerPad * 2,
        Math.max(1, radius - 1)
      );
      graphics.fill({ color: resolvedColor, alpha: 0.12 * alpha });
    }

    // Borde principal brillante del tubo de neón
    graphics.roundRect(bx, by, bw, bh, radius);
    graphics.stroke({ color: resolvedColor, width: 2, alpha: 0.98 * alpha });

    // Filamento claro sutil en el centro del borde
    graphics.roundRect(
      bx + 0.75,
      by + 0.75,
      bw - 1.5,
      bh - 1.5,
      Math.max(1, radius - 0.5)
    );
    graphics.stroke({ color: 0xffffff, width: 0.6, alpha: 0.28 * alpha });
    return;
  }

  // Modo clásico sin neón (default)
  if (isGhost) {
    graphics.rect(x + 1, y + 1, size - 2, size - 2);
    graphics.stroke({ color: resolvedColor, width: 1.5, alpha: 0.75 });
    return;
  }

  graphics.rect(x, y, size, size);
  graphics.fill({ color: resolvedColor, alpha });

  graphics.stroke({ color: 0x000000, width: 1, alpha: 0.25 });
}

/**
 * Dibuja un marco limpio con resplandor neón contenido sin recortarse en los bordes.
 */
function drawNeonFrame(
  glowGfx,
  bgGfx,
  { x = 0, y = 0, width, height, radius = 8, neonColor, neonEnabled }
) {
  glowGfx.clear();
  bgGfx.clear();

  if (!neonEnabled) {
    bgGfx.roundRect(x, y, width, height, radius);
    bgGfx.fill({ color: 0x111111, alpha: 0.95 });
    bgGfx.stroke({ color: 0x2a2a2a, width: 1.5 });
    return;
  }

  // Fondo oscuro uniforme
  bgGfx.roundRect(x, y, width, height, radius);
  bgGfx.fill({ color: 0x080c16, alpha: 0.96 });

  // Resplandor suave hacia el interior del marco (evita recorte en bordes exteriores)
  glowGfx.roundRect(
    x + 2,
    y + 2,
    Math.max(4, width - 4),
    Math.max(4, height - 4),
    Math.max(2, radius - 1)
  );
  glowGfx.stroke({ color: neonColor, width: 3.5, alpha: 0.16 });

  // Línea principal nítida del marco
  bgGfx.roundRect(
    x + 1,
    y + 1,
    Math.max(4, width - 2),
    Math.max(4, height - 2),
    radius
  );
  bgGfx.stroke({ color: neonColor, width: 2, alpha: 0.95 });

  // Filamento interno suave
  bgGfx.roundRect(
    x + 2,
    y + 2,
    Math.max(2, width - 4),
    Math.max(2, height - 4),
    Math.max(1, radius - 1)
  );
  bgGfx.stroke({ color: 0xffffff, width: 0.5, alpha: 0.22 });
}

function drawCenteredPieceInSlot(
  graphics,
  pieceType,
  pieces,
  slotWidth,
  slotHeight,
  previewCellSize,
  neonEnabled = false
) {
  graphics.clear();

  if (!pieceType || !pieces[pieceType]) return;

  const { shape, color } = pieces[pieceType];
  const bounds = getShapeBounds(shape);
  if (bounds.widthCells === 0) return;

  const piecePixelW = bounds.widthCells * previewCellSize;
  const piecePixelH = bounds.heightCells * previewCellSize;

  const offsetX = (slotWidth - piecePixelW) / 2 - bounds.minCol * previewCellSize;
  const offsetY = (slotHeight - piecePixelH) / 2 - bounds.minRow * previewCellSize;

  shape.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      if (val !== 0) {
        const x = offsetX + cIdx * previewCellSize;
        const y = offsetY + rIdx * previewCellSize;
        drawBlock(graphics, x, y, previewCellSize, color, {
          neonEnabled,
          pieceType,
        });
      }
    });
  });
}

function drawTopoutNextPreview(graphics, nextPieceType, pieces, cols, cellSize) {
  graphics.clear();

  if (!nextPieceType || !pieces[nextPieceType]) return;

  const { shape } = pieces[nextPieceType];
  const bounds = getShapeBounds(shape);
  if (bounds.widthCells === 0) return;

  const topoutRed = 0xff2a2a;
  const startCol = Math.floor((cols - bounds.widthCells) / 2) - bounds.minCol;
  const startRow = 0 - bounds.minRow;

  shape.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      if (val !== 0) {
        const targetRow = startRow + rIdx;
        const targetCol = startCol + cIdx;
        if (targetRow >= 0 && targetRow <= 1 && targetCol >= 0 && targetCol < cols) {
          drawBlock(
            graphics,
            targetCol * cellSize,
            targetRow * cellSize,
            cellSize,
            topoutRed,
            { alpha: 0.5, isTopoutPreview: true, pieceType: nextPieceType }
          );
        }
      }
    });
  });
}

function formatSprintTime(ms = 0) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = safeMs / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const minsStr = String(mins).padStart(2, '0');
  const secsStr = secs.toFixed(2).padStart(5, '0');
  return `${minsStr}:${secsStr}`;
}

export async function createGamePlayer({
  containerEl,
  rows = 20,
  cols = 10,
  cellSize = 26,
  nextCount = DEFAULT_SETTINGS.nextCount,
  bufferRows = 2,
  linesGoal = 40,
  neonEnabled: initialNeonEnabled = DEFAULT_SETTINGS.neonEnabled,
  username: initialUsername = DEFAULT_SETTINGS.username,
  controls: initialControls = CONTROLS,
}) {
  if (!containerEl) return null;

  const app = new Application();
  let destroyed = false;
  let unsubscribe = null;

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unsubscribe?.();
    unsubscribe = null;
    try {
      app.destroy(true, { children: true, texture: true });
    } catch (err) {
      console.warn('[renderer] Error al destruir Application:', err);
    }
  }

  let neonEnabled = Boolean(
    initialNeonEnabled ??
      DEFAULT_SETTINGS.neonEnabled ??
      DEFAULT_SETTINGS.appearance === 'neon'
  );
  let activeNextCount = clampNextCount(nextCount);
  let activeUsername =
    typeof initialUsername === 'string' && initialUsername.trim()
      ? initialUsername.trim()
      : DEFAULT_SETTINGS.username;
  let activeControls = { ...CONTROLS, ...(initialControls || {}) };
  let lastRenderPayload = null;

  const slotWidth = cellSize * 4.2;
  const slotHeight = cellSize * 3.2;
  const slotGap = 10;
  const panelGap = 16;
  const previewCellSize = Math.floor(cellSize * 0.72);
  const topBufferHeight = Math.max(0, bufferRows) * cellSize;
  const bottomUserHeight = 32;

  const boardWidth = cols * cellSize;
  const boardHeight = rows * cellSize;
  const maxNextTotalHeight =
    MAX_NEXT_COUNT * slotHeight + Math.max(0, MAX_NEXT_COUNT - 1) * slotGap;

  const canvasWidth = slotWidth + panelGap + boardWidth + panelGap + slotWidth;
  const canvasHeight =
    topBufferHeight + Math.max(boardHeight + bottomUserHeight, maxNextTotalHeight);

  await app.init({
    width: canvasWidth,
    height: canvasHeight,
    backgroundAlpha: 0,
    antialias: true,
  });

  if (destroyed || !containerEl.isConnected) {
    destroy();
    return null;
  }

  containerEl.innerHTML = '';
  containerEl.appendChild(app.canvas);

  const holdContainer = new Container();
  const boardContainer = new Container();
  const nextContainer = new Container();
  const effectsContainer = new Container();

  holdContainer.position.set(0, topBufferHeight);
  boardContainer.position.set(slotWidth + panelGap, topBufferHeight);
  nextContainer.position.set(slotWidth + panelGap + boardWidth + panelGap, topBufferHeight);
  effectsContainer.position.set(0, topBufferHeight);

  app.stage.addChild(holdContainer, boardContainer, nextContainer, effectsContainer);

  // HOLD SLOT
  const holdGlow = new Graphics();
  holdGlow.blendMode = 'add';
  holdContainer.addChild(holdGlow);

  const holdBg = new Graphics();
  holdContainer.addChild(holdBg);

  const holdPieceGraphics = new Graphics();
  holdContainer.addChild(holdPieceGraphics);

  // PANEL INFERIOR IZQUIERDO: STATS (LÍNEAS, TIEMPO, PPS, FINESSE)
  const statsHeight = 160;
  const statsY = boardHeight - statsHeight;

  const statsGlow = new Graphics();
  statsGlow.blendMode = 'add';
  holdContainer.addChild(statsGlow);

  const statsBg = new Graphics();
  holdContainer.addChild(statsBg);

  const makeStatBlock = (label, defaultValue, offsetY) => {
    const lbl = new Text({
      text: label,
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1.1,
        fill: 0x8a8a8a,
      },
    });
    lbl.position.set(10, statsY + offsetY);

    const val = new Text({
      text: defaultValue,
      style: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13.5,
        fontWeight: '700',
        fill: 0xffffff,
      },
    });
    val.position.set(10, statsY + offsetY + 11);

    holdContainer.addChild(lbl, val);
    return { lbl, val };
  };

  const linesStat = makeStatBlock('LÍNEAS', `0 / ${linesGoal}`, 6);
  const timeStat = makeStatBlock('TIEMPO', '00:00.00', 44);
  const ppsStat = makeStatBlock('PPS', '0.00', 82);
  const finesseStat = makeStatBlock('FINESSE', '0 (100%)', 120);

  // CONTROLES CONFIGURADOS ENCIMA DE LAS STATS
  const controlsGap = 8;
  const controlsBoxHeight = 160;
  const controlsBoxY = statsY - controlsBoxHeight - controlsGap;

  const controlsGlow = new Graphics();
  controlsGlow.blendMode = 'add';
  holdContainer.addChild(controlsGlow);

  const controlsBg = new Graphics();
  holdContainer.addChild(controlsBg);

  const controlsTitleText = new Text({
    text: 'CONTROLES',
    style: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.1,
      fill: 0x8a8a8a,
    },
  });
  controlsTitleText.position.set(9, controlsBoxY + 6);
  holdContainer.addChild(controlsTitleText);

  const controlKeyTexts = {};
  CONTROL_ROWS.forEach(({ action, shortLabel }, index) => {
    const rowY = controlsBoxY + 20 + index * 15;

    const actionLbl = new Text({
      text: shortLabel,
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 9.5,
        fontWeight: '600',
        fill: 0xb8c0d4,
      },
    });
    actionLbl.position.set(9, rowY);

    const keyVal = new Text({
      text: formatKeyForCanvas(activeControls[action]),
      style: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 9.5,
        fontWeight: '700',
        fill: 0xffffff,
      },
    });
    keyVal.anchor.set(1, 0);
    keyVal.position.set(slotWidth - 9, rowY);

    holdContainer.addChild(actionLbl, keyVal);
    controlKeyTexts[action] = { actionLbl, keyVal };
  });

  // TABLERO
  const boardGlow = new Graphics();
  boardGlow.blendMode = 'add';
  boardContainer.addChild(boardGlow);

  const boardBg = new Graphics();
  boardContainer.addChild(boardBg);

  const gridLines = new Graphics();
  boardContainer.addChild(gridLines);

  const lockedGraphics = new Graphics();
  const topoutPreviewGraphics = new Graphics();
  const ghostGraphics = new Graphics();
  const activeGraphics = new Graphics();
  boardContainer.addChild(lockedGraphics, topoutPreviewGraphics, ghostGraphics, activeGraphics);

  // NOMBRE DE USUARIO DEBAJO DEL TABLERO
  const usernameText = new Text({
    text: activeUsername,
    style: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      fill: 0xe5e9f2,
    },
  });
  usernameText.anchor.set(0.5, 0);
  usernameText.position.set(boardWidth / 2, boardHeight + 8);
  boardContainer.addChild(usernameText);

  // NEXT SLOTS (hasta MAX_NEXT_COUNT = 5)
  const nextSlotItems = [];

  for (let i = 0; i < MAX_NEXT_COUNT; i++) {
    const y = i * (slotHeight + slotGap);
    const isVisible = i < activeNextCount;

    const glowGfx = new Graphics();
    glowGfx.blendMode = 'add';
    glowGfx.visible = isVisible;
    nextContainer.addChild(glowGfx);

    const slotBg = new Graphics();
    slotBg.visible = isVisible;
    nextContainer.addChild(slotBg);

    const pieceGfx = new Graphics();
    pieceGfx.position.set(0, y);
    pieceGfx.visible = isVisible;
    nextContainer.addChild(pieceGfx);

    nextSlotItems.push({ glowGfx, slotBg, pieceGfx });
  }

  function refreshControlsText() {
    CONTROL_ROWS.forEach(({ action }) => {
      if (controlKeyTexts[action]) {
        controlKeyTexts[action].keyVal.text = formatKeyForCanvas(activeControls[action]);
      }
    });
  }

  function applyChromeStyles() {
    const accentCyan = 0x00f0ff;
    const accentPink = 0xff2a85;
    const accentViolet = 0xb537f2;

    // Mezcla normal en piezas para conservar saturación y nitidez sin blanquear
    lockedGraphics.blendMode = 'normal';
    activeGraphics.blendMode = 'normal';
    ghostGraphics.blendMode = 'normal';
    holdPieceGraphics.blendMode = 'normal';
    gridLines.blendMode = 'normal';

    // frame del tablero
    drawNeonFrame(boardGlow, boardBg, {
      width: boardWidth,
      height: boardHeight,
      radius: 6,
      neonColor: accentCyan,
      neonEnabled,
    });

    // Nombre de usuario debajo del tablero
    usernameText.style.fill = neonEnabled ? accentCyan : 0xe5e9f2;

    // Hold slot
    drawNeonFrame(holdGlow, holdBg, {
      width: slotWidth,
      height: slotHeight,
      radius: 8,
      neonColor: accentViolet,
      neonEnabled,
    });

    // Panel de controles encima del panel de stats
    drawNeonFrame(controlsGlow, controlsBg, {
      y: controlsBoxY,
      width: slotWidth,
      height: controlsBoxHeight,
      radius: 8,
      neonColor: accentCyan,
      neonEnabled,
    });
    controlsTitleText.style.fill = neonEnabled ? accentCyan : 0x8a8a8a;

    CONTROL_ROWS.forEach(({ action }) => {
      const entry = controlKeyTexts[action];
      if (!entry) return;
      entry.actionLbl.style.fill = neonEnabled ? 0xdbe7ff : 0xb8c0d4;
      entry.keyVal.style.fill = neonEnabled ? accentPink : 0xffffff;
    });

    // Panel de stats
    drawNeonFrame(statsGlow, statsBg, {
      y: statsY,
      width: slotWidth,
      height: statsHeight,
      radius: 8,
      neonColor: accentPink,
      neonEnabled,
    });

    const statEntries = [linesStat, timeStat, ppsStat, finesseStat];
    statEntries.forEach(({ lbl, val }, idx) => {
      lbl.style.fill = neonEnabled ? (idx % 2 === 0 ? accentCyan : accentPink) : 0x8a8a8a;
      val.style.fill = neonEnabled ? 0xf7fcff : 0xffffff;
    });

    // Lineas de la grilla
    gridLines.clear();
    for (let c = 1; c < cols; c++) {
      gridLines.moveTo(c * cellSize, 0);
      gridLines.lineTo(c * cellSize, boardHeight);
    }
    for (let r = 1; r < rows; r++) {
      gridLines.moveTo(0, r * cellSize);
      gridLines.lineTo(boardWidth, r * cellSize);
    }
    gridLines.stroke({
      color: neonEnabled ? accentCyan : 0xffffff,
      width: 1,
      alpha: neonEnabled ? 0.09 : 0.05,
    });

    // Next slots
    for (let i = 0; i < MAX_NEXT_COUNT; i++) {
      const y = i * (slotHeight + slotGap);
      const { glowGfx, slotBg, pieceGfx } = nextSlotItems[i];
      const isVisible = i < activeNextCount;

      glowGfx.visible = isVisible;
      slotBg.visible = isVisible;
      pieceGfx.visible = isVisible;
      pieceGfx.blendMode = 'normal';

      if (!isVisible) {
        glowGfx.clear();
        slotBg.clear();
        pieceGfx.clear();
        continue;
      }

      const slotColor = i === 0 ? accentCyan : accentViolet;
      drawNeonFrame(glowGfx, slotBg, {
        y,
        width: slotWidth,
        height: slotHeight,
        radius: 8,
        neonColor: slotColor,
        neonEnabled,
      });
    }
  }

  applyChromeStyles();

  function render({
    grid,
    activePiece,
    ghostPiece,
    holdPiece,
    nextPieces = [],
    pieces,
    showTopoutNextPreview = false,
    pps = 0,
    elapsedMs = 0,
    linesCleared = 0,
    finesseFaults = 0,
    finesseAccuracy = 100,
    neonEnabled: nextNeonEnabled,
    nextCount: nextCountOverride,
    username: nextUsername,
    controls: nextControls,
  }) {
    if (destroyed) return;

    let styleChanged = false;

    const resolvedNeon =
      typeof nextNeonEnabled === 'boolean'
        ? nextNeonEnabled
        : Boolean(
            DEFAULT_SETTINGS.neonEnabled ?? DEFAULT_SETTINGS.appearance === 'neon'
          );

    if (resolvedNeon !== neonEnabled) {
      neonEnabled = resolvedNeon;
      styleChanged = true;
    }

    if (typeof nextCountOverride === 'number') {
      const clamped = clampNextCount(nextCountOverride);
      if (clamped !== activeNextCount) {
        activeNextCount = clamped;
        styleChanged = true;
      }
    }

    if (typeof nextUsername === 'string') {
      const cleanName = nextUsername.trim() || DEFAULT_SETTINGS.username;
      if (cleanName !== activeUsername) {
        activeUsername = cleanName;
      }
    }

    if (nextControls && typeof nextControls === 'object') {
      activeControls = { ...CONTROLS, ...nextControls };
      refreshControlsText();
    }

    if (styleChanged) {
      applyChromeStyles();
    }

    lastRenderPayload = {
      grid,
      activePiece,
      ghostPiece,
      holdPiece,
      nextPieces,
      pieces,
      showTopoutNextPreview,
      pps,
      elapsedMs,
      linesCleared,
      finesseFaults,
      finesseAccuracy,
      neonEnabled,
      nextCount: activeNextCount,
      username: activeUsername,
      controls: activeControls,
    };

    usernameText.text = activeUsername;
    linesStat.val.text = `${Math.min(linesCleared, linesGoal)} / ${linesGoal}`;
    timeStat.val.text = formatSprintTime(elapsedMs);
    ppsStat.val.text = Number(pps || 0).toFixed(2);
    finesseStat.val.text = `${finesseFaults} (${Number(finesseAccuracy).toFixed(1)}%)`;

    // Grilla bloqueada 20x10
    lockedGraphics.clear();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = grid[row]?.[col];
        if (cell && cell !== 0 && pieces[cell]) {
          drawBlock(
            lockedGraphics,
            col * cellSize,
            row * cellSize,
            cellSize,
            pieces[cell].color,
            { neonEnabled, pieceType: cell }
          );
        }
      }
    }

    // Previsualización de topout
    drawTopoutNextPreview(
      topoutPreviewGraphics,
      showTopoutNextPreview ? nextPieces?.[0] || null : null,
      pieces,
      cols,
      cellSize
    );

    // Pieza fantasma
    ghostGraphics.clear();
    if (ghostPiece?.shape && pieces[ghostPiece.type]) {
      const color = '#fff';
      ghostPiece.shape.forEach((rowArr, rIdx) => {
        rowArr.forEach((val, cIdx) => {
          if (val !== 0) {
            const targetRow = ghostPiece.pos.y + rIdx;
            const targetCol = ghostPiece.pos.x + cIdx;
            if (targetRow >= 0 && targetRow < rows && targetCol >= 0 && targetCol < cols) {
              drawBlock(
                ghostGraphics,
                targetCol * cellSize,
                targetRow * cellSize,
                cellSize,
                color,
                {
                  alpha: 0.25,
                  isGhost: true,
                  neonEnabled,
                  pieceType: ghostPiece.type,
                }
              );
            }
          }
        });
      });
    }

    // Pieza activa
    activeGraphics.clear();
    if (activePiece?.shape && pieces[activePiece.type]) {
      const color = pieces[activePiece.type].color;
      activePiece.shape.forEach((rowArr, rIdx) => {
        rowArr.forEach((val, cIdx) => {
          if (val !== 0) {
            const targetRow = activePiece.pos.y + rIdx;
            const targetCol = activePiece.pos.x + cIdx;
            if (targetRow < rows && targetCol >= 0 && targetCol < cols) {
              drawBlock(
                activeGraphics,
                targetCol * cellSize,
                targetRow * cellSize,
                cellSize,
                color,
                { neonEnabled, pieceType: activePiece.type }
              );
            }
          }
        });
      });
    }

    // Hold slot
    drawCenteredPieceInSlot(
      holdPieceGraphics,
      holdPiece,
      pieces,
      slotWidth,
      slotHeight,
      previewCellSize,
      neonEnabled
    );

    // Slots de Next visibles (1 a 5)
    for (let i = 0; i < MAX_NEXT_COUNT; i++) {
      const { pieceGfx } = nextSlotItems[i];
      if (i >= activeNextCount) {
        pieceGfx.clear();
        continue;
      }

      const pieceType = nextPieces[i] || null;
      drawCenteredPieceInSlot(
        pieceGfx,
        pieceType,
        pieces,
        slotWidth,
        slotHeight,
        previewCellSize,
        neonEnabled
      );
    }
  }

  function setNeonEnabled(enabled) {
    if (destroyed) return;
    const nextVal = Boolean(enabled);
    if (nextVal === neonEnabled) return;
    neonEnabled = nextVal;
    applyChromeStyles();
    if (lastRenderPayload) {
      render({ ...lastRenderPayload, neonEnabled });
    }
  }

  function setNextCount(count) {
    if (destroyed) return;
    const nextVal = clampNextCount(count);
    if (nextVal === activeNextCount) return;
    activeNextCount = nextVal;
    applyChromeStyles();
    if (lastRenderPayload) {
      render({ ...lastRenderPayload, nextCount: activeNextCount });
    }
  }

  function setUsername(name) {
    if (destroyed) return;
    const cleanName =
      typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_SETTINGS.username;
    if (cleanName === activeUsername) return;
    activeUsername = cleanName;
    usernameText.text = activeUsername;
    if (lastRenderPayload) {
      lastRenderPayload = { ...lastRenderPayload, username: activeUsername };
    }
  }

  function setControls(nextControls) {
    if (destroyed) return;
    if (!nextControls || typeof nextControls !== 'object') return;
    activeControls = { ...CONTROLS, ...nextControls };
    refreshControlsText();
    if (lastRenderPayload) {
      lastRenderPayload = { ...lastRenderPayload, controls: activeControls };
    }
  }

  // Escucha cambios globales en configuración para actualizar al instante
  unsubscribe = subscribeSettings((nextSettings) => {
    if (destroyed) return;

    const nextNeon = Boolean(
      nextSettings?.neonEnabled ?? nextSettings?.appearance === 'neon'
    );
    const nextCountVal =
      typeof nextSettings?.nextCount === 'number'
        ? clampNextCount(nextSettings.nextCount)
        : activeNextCount;
    const nextNameVal =
      typeof nextSettings?.username === 'string' && nextSettings.username.trim()
        ? nextSettings.username.trim()
        : activeUsername;
    const nextCtrlVal =
      nextSettings?.controls && typeof nextSettings.controls === 'object'
        ? { ...CONTROLS, ...nextSettings.controls }
        : activeControls;

    let chromeDirty = false;

    if (nextNeon !== neonEnabled) {
      neonEnabled = nextNeon;
      chromeDirty = true;
    }

    if (nextCountVal !== activeNextCount) {
      activeNextCount = nextCountVal;
      chromeDirty = true;
    }

    if (nextNameVal !== activeUsername) {
      activeUsername = nextNameVal;
      usernameText.text = activeUsername;
    }

    if (nextSettings?.controls) {
      activeControls = nextCtrlVal;
      refreshControlsText();
    }

    if (chromeDirty) {
      applyChromeStyles();
    }

    if (lastRenderPayload) {
      render({
        ...lastRenderPayload,
        neonEnabled,
        nextCount: activeNextCount,
        username: activeUsername,
        controls: activeControls,
      });
    }
  });

  return {
    app,
    effectsContainer,
    render,
    setNeonEnabled,
    setNextCount,
    setUsername,
    setControls,
    destroy,
  };
}
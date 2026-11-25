import { PIECES } from '../../utils/constants/pieces';
import { getBag } from './bag';

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

export function getTopoutZoneCells(nextPieceType, cols, topoutVisibleRows) {
  const piece = nextPieceType && PIECES[nextPieceType] ? PIECES[nextPieceType] : null;
  const fallbackShape = [
    [1, 1],
    [1, 1],
  ];
  const shape = piece?.shape || fallbackShape;
  const bounds = getShapeBounds(shape);
  if (bounds.widthCells === 0) return [];

  const startCol = Math.floor((cols - bounds.widthCells) / 2) - bounds.minCol;
  const startRow = topoutVisibleRows[0] - bounds.minRow;
  const maxTopoutRow = topoutVisibleRows[topoutVisibleRows.length - 1];
  const cells = [];

  shape.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      if (val !== 0) {
        const targetRow = startRow + rIdx;
        const targetCol = startCol + cIdx;
        if (
          targetRow >= topoutVisibleRows[0] &&
          targetRow <= maxTopoutRow &&
          targetCol >= 0 &&
          targetCol < cols
        ) {
          cells.push({ row: targetRow, col: targetCol });
        }
      }
    });
  });

  return cells;
}

export function buildInitialQueue(minSize = 10) {
  const queue = [];
  while (queue.length < minSize) {
    queue.push(...getBag());
  }
  return queue;
}

export function getVisibleNextPieces({ hasStarted, bag, nextCount }) {
  if (!hasStarted || bag.length === 0) return [];
  const queue = [...bag];
  while (queue.length < nextCount) {
    queue.push(...getBag());
  }
  return queue.slice(0, nextCount);
}

export function popNextPieceFromBag(currentBag, nextCount) {
  let working =
    currentBag.length > 0 ? [...currentBag] : buildInitialQueue(nextCount + 7);
  const pieceType = working[0];
  working = working.slice(1);
  while (working.length < nextCount + 2) {
    working.push(...getBag());
  }
  return {
    pieceType,
    updatedBag: working,
    nextPieces: working.slice(0, nextCount),
  };
}
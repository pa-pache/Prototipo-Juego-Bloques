export function createEmptyGrid(totalRows, cols) {
  return Array.from({ length: totalRows }, () => Array(cols).fill(0));
}

export function getVisibleBoardGrid(fullGrid, bufferRows) {
  return fullGrid.slice(bufferRows);
}

export function hasReachedMinRowForTopoutPreview(visibleBoardGrid, minRowForTopoutPreview) {
  for (let r = 0; r <= Math.min(minRowForTopoutPreview, visibleBoardGrid.length - 1); r++) {
    if (visibleBoardGrid[r]?.some((val) => val !== 0)) {
      return true;
    }
  }
  return false;
}

export function touchesTopoutZone({
  fullGrid,
  bufferRows,
  nextPieceType,
  cols,
  topoutVisibleRows,
  getTopoutZoneCellsFn,
}) {
  const visibleBoardGrid = getVisibleBoardGrid(fullGrid, bufferRows);
  const topoutCells = getTopoutZoneCellsFn(nextPieceType, cols, topoutVisibleRows);
  return topoutCells.some(({ row, col }) => {
    const cell = visibleBoardGrid[row]?.[col];
    return Boolean(cell && cell !== 0);
  });
}
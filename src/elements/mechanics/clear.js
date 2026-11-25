export function findFullLines(grid) {
  const linesToClear = [];
  grid.forEach((row, idx) => {
    if (row.every((val) => val !== 0)) {
      linesToClear.push(idx);
    }
  });
  return linesToClear;
}

export function buildFlashedGrid(grid, linesToClear, cols) {
  return grid.map((row, idx) =>
    linesToClear.includes(idx) ? Array(cols).fill(0) : row
  );
}

export function collapseClearedLines(grid, linesToClear, cols) {
  const filteredGrid = grid.filter((_, idx) => !linesToClear.includes(idx));
  const emptyRows = Array.from({ length: linesToClear.length }, () => Array(cols).fill(0));
  return [...emptyRows, ...filteredGrid];
}

export async function clearLinesSequence({
  grid,
  linesToClear,
  cols,
  skipAnimation,
  cleanTimeoutRef,
  onFlashGrid,
  isCancelled,
  flashDurationMs = 150,
}) {
  if (!skipAnimation) {
    const flashedGrid = buildFlashedGrid(grid, linesToClear, cols);
    onFlashGrid(flashedGrid);

    await new Promise((resolve) => {
      cleanTimeoutRef.current = setTimeout(resolve, flashDurationMs);
    });
    cleanTimeoutRef.current = null;

    if (isCancelled?.()) {
      return null;
    }
  }

  return collapseClearedLines(grid, linesToClear, cols);
}
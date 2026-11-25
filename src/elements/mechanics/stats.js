// Calcula un mínimo de pasos esperados para llegar desde el spawn a la posición/rotación final
export function estimateMinimumMoves(piece, spawnX) {
  if (!piece) return 0;
  const baseSpawnX = piece.type === 'O' ? spawnX + 1 : spawnX;
  const dx = Math.abs((piece.pos?.x ?? baseSpawnX) - baseSpawnX);
  const rotSteps =
    piece.rotacion === '0'
      ? 0
      : piece.rotacion === '2' || piece.rotacion === '180'
      ? 2
      : 1;
  return dx + rotSteps;
}

export function createStatsTracker() {
  return {
    piecesPlaced: 0,
    linesCleared: 0,
    activeTimeMs: 0,
    elapsedMs: 0,
    pps: 0,
    lastFrameTime: null,
    pieceInputs: 0,
    finesseFaults: 0,
    finesseAccuracy: 100,
  };
}

export function resetStatsTracker(stats) {
  stats.piecesPlaced = 0;
  stats.linesCleared = 0;
  stats.activeTimeMs = 0;
  stats.elapsedMs = 0;
  stats.pps = 0;
  stats.lastFrameTime = null;
  stats.pieceInputs = 0;
  stats.finesseFaults = 0;
  stats.finesseAccuracy = 100;
}

export function getStatsSnapshot(stats) {
  return {
    piecesPlaced: stats.piecesPlaced,
    linesCleared: stats.linesCleared,
    elapsedMs: stats.elapsedMs,
    pps: stats.pps,
    finesseFaults: stats.finesseFaults,
    finesseAccuracy: stats.finesseAccuracy,
  };
}

export function computePps(stats) {
  const count = stats.piecesPlaced;
  const elapsedSeconds = stats.activeTimeMs / 1000;
  if (count <= 0 || elapsedSeconds <= 0) {
    stats.pps = 0;
    return 0;
  }
  const nextPps = Number((count / elapsedSeconds).toFixed(2));
  stats.pps = nextPps;
  return nextPps;
}

export function recordPieceInput(stats, amount = 1) {
  stats.pieceInputs += amount;
}

export function resetPieceInputs(stats) {
  stats.pieceInputs = 0;
}

export function recordPieceFinesseOnLock(stats, piece, spawnX) {
  const actualInputs = stats.pieceInputs;
  const minExpected = estimateMinimumMoves(piece, spawnX);
  // Tolerancia de 1 movimiento adicional para ajustes finos / wall kicks
  const extraFaults = Math.max(0, actualInputs - minExpected - 1);

  const nextFaults = stats.finesseFaults + extraFaults;
  stats.finesseFaults = nextFaults;

  const totalPieces = Math.max(1, stats.piecesPlaced);
  const accuracy = Math.max(
    0,
    Math.min(100, ((totalPieces - nextFaults) / totalPieces) * 100)
  );
  const roundedAcc = Number(accuracy.toFixed(1));
  stats.finesseAccuracy = roundedAcc;

  stats.pieceInputs = 0;
}

export function recordPiecePlacedAndFinesse(stats, piece, spawnX) {
  stats.piecesPlaced += 1;
  recordPieceFinesseOnLock(stats, piece, spawnX);
  computePps(stats);
}

export function addClearedLines(stats, linesCount) {
  stats.linesCleared += linesCount;
  return stats.linesCleared;
}

export function stepActiveTime(stats, now, shouldAccumulate) {
  if (shouldAccumulate) {
    if (stats.lastFrameTime !== null) {
      const deltaMs = Math.max(0, now - stats.lastFrameTime);
      stats.activeTimeMs += deltaMs;
      stats.elapsedMs = stats.activeTimeMs;
      computePps(stats);
    }
    stats.lastFrameTime = now;
  } else {
    stats.lastFrameTime = now;
  }
}

export function pauseFrameTimer(stats) {
  stats.lastFrameTime = null;
}

export function resumeFrameTimer(stats, now = performance.now()) {
  stats.lastFrameTime = now;
}
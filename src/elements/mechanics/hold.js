export function canPerformHold({
  currentPiece,
  isCleaning,
  isMatchEnded,
  isGameplayBlocked,
  canHold,
  lockingInProgress,
  inputLocked,
}) {
  return Boolean(
    currentPiece &&
      !isCleaning &&
      !isMatchEnded &&
      !isGameplayBlocked &&
      canHold &&
      !lockingInProgress &&
      !inputLocked
  );
}

export function resolveHoldPiece({ currentPiece, holdPiece, popNextPieceType }) {
  if (holdPiece === null) {
    return {
      nextHoldPiece: currentPiece.type,
      pieceToSpawn: popNextPieceType(),
    };
  }

  return {
    nextHoldPiece: currentPiece.type,
    pieceToSpawn: holdPiece,
  };
}
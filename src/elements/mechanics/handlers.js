export function createMatchHandlers({
  clearLockTimeout,
  clearCleanTimeout,
  lockingInProgressRef,
  inputLockedRef,
  resetInputState,
  buildInitialQueue,
  nextCount,
  createEmptyGrid,
  totalRows,
  cols,
  createSpawnPiece,
  pieces,
  spawnX,
  resetStatsTracker,
  statsRef,
  handlingStateRef,
  syncStatsState,
  setIsGameOver,
  isGameOverRef,
  setIsSprintComplete,
  isSprintCompleteRef,
  setIsClutch,
  isClutchRef,
  setIsCleaning,
  isCleaningRef,
  setIsGrounded,
  isGroundedRef,
  setMoveResets,
  moveResetsRef,
  setHoldPiece,
  holdPieceRef,
  setCanHold,
  canHoldRef,
  setGrid,
  gridRef,
  setBag,
  bagRef,
  nextPiecesRef,
  setActivePiece,
  activePieceRef,
  setHasStarted,
  hasStartedRef,
  setCountdown,
  countdownRef,
  setIsConfigOpen,
  isConfigOpenRef,
  syncSceneRender,
  startCountdown,
  isMatchEnded,
  isGameplayBlocked,
  recalculatePps,
  resetPieceInputs,
  ensureHeldHorizontalDir,
  controlsRef,
  dasRef,
  canSpawnAtPosition,
  popNextPieceFromBag,
  lockPieceIntoGrid,
  recordPiecePlacedAndFinesse,
  findFullLines,
  touchesTopoutZone,
  bufferRows,
  topoutVisibleRows,
  getTopoutZoneCells,
  settingsRef,
  clearLinesSequence,
  addClearedLines,
  setLinesCleared,
  linesGoal,
  clearHorizontalPrimaryDir,
  maxLockResets,
  hasPieceChanged,
  recordPieceInput,
  moveFn,
  canPerformHold,
  resolveHoldPiece,
}) {
  const triggerTopOut = () => {
    clearLockTimeout();
    clearCleanTimeout();
    lockingInProgressRef.current = false;
    inputLockedRef.current = false;
    resetInputState(true);

    isGroundedRef.current = false;
    setIsGrounded(false);
    moveResetsRef.current = 0;
    setMoveResets(0);

    activePieceRef.current = null;
    setActivePiece(null);

    isGameOverRef.current = true;
    setIsGameOver(true);

    recalculatePps();
    syncSceneRender();
  };

  const triggerSprintComplete = () => {
    clearLockTimeout();
    clearCleanTimeout();
    lockingInProgressRef.current = false;
    inputLockedRef.current = false;
    resetInputState(true);

    isGroundedRef.current = false;
    setIsGrounded(false);
    moveResetsRef.current = 0;
    setMoveResets(0);

    activePieceRef.current = null;
    setActivePiece(null);

    isSprintCompleteRef.current = true;
    setIsSprintComplete(true);

    recalculatePps();
    syncSceneRender();
  };

  const spawnPiece = (pieceType, currentGrid = gridRef.current) => {
    if (isMatchEnded() || !hasStartedRef.current) return null;

    resetPieceInputs(statsRef.current);
    clearLockTimeout();
    setIsGrounded(false);
    isGroundedRef.current = false;
    setMoveResets(0);
    moveResetsRef.current = 0;
    lockingInProgressRef.current = false;
    inputLockedRef.current = false;
    ensureHeldHorizontalDir({
      handlingState: handlingStateRef.current,
      controls: controlsRef.current,
      das: dasRef.current,
      isGameplayBlocked: isGameplayBlocked(),
      now: performance.now(),
    });

    const candidate = createSpawnPiece(pieces, pieceType, spawnX);

    if (!canSpawnAtPosition(currentGrid, candidate, cols)) {
      triggerTopOut();
      return null;
    }

    activePieceRef.current = candidate;
    setActivePiece(candidate);
    syncSceneRender();
    return candidate;
  };

  const popNextPieceType = () => {
    const { pieceType, updatedBag, nextPieces: updatedNextPieces } = popNextPieceFromBag(
      bagRef.current,
      nextCount
    );
    bagRef.current = updatedBag;
    setBag(updatedBag);
    nextPiecesRef.current = updatedNextPieces;
    return pieceType;
  };

  const lockPieceToGrid = (currentGrid, piece) => {
    const newGrid = lockPieceIntoGrid(currentGrid, piece, cols);
    if (newGrid !== currentGrid) {
      recordPiecePlacedAndFinesse(statsRef.current, piece, spawnX);
      syncStatsState();
    }
    return newGrid;
  };

  const processLanding = async (pieceToLock) => {
    clearLockTimeout();
    const updatedGrid = lockPieceToGrid(gridRef.current, pieceToLock);

    const linesToClear = findFullLines(updatedGrid);

    const isTouchingTopout = touchesTopoutZone({
      fullGrid: updatedGrid,
      bufferRows,
      nextPieceType: nextPiecesRef.current?.[0] || null,
      cols,
      topoutVisibleRows,
      getTopoutZoneCellsFn: getTopoutZoneCells,
    });

    if (isTouchingTopout && linesToClear.length === 0) {
      gridRef.current = updatedGrid;
      setGrid(updatedGrid);
      triggerTopOut();
      return;
    }

    if (isTouchingTopout && linesToClear.length > 0) {
      isClutchRef.current = true;
      setIsClutch(true);
    } else if (isClutchRef.current) {
      isClutchRef.current = false;
      setIsClutch(false);
    }

    if (linesToClear.length > 0) {
      const skipAnimation = Boolean(settingsRef.current?.skipLineClearAnimation);

      if (!skipAnimation) {
        isCleaningRef.current = true;
        setIsCleaning(true);
      }

      const finalGrid = await clearLinesSequence({
        grid: updatedGrid,
        linesToClear,
        cols,
        skipAnimation,
        cleanTimeoutRef: clearCleanTimeout.cleanTimeoutRef,
        onFlashGrid: (flashedGrid) => {
          gridRef.current = flashedGrid;
          setGrid(flashedGrid);
          syncSceneRender();
        },
        isCancelled: () => isGameOverRef.current,
      });

      if (!finalGrid) return;

      const nextLinesTotal = addClearedLines(statsRef.current, linesToClear.length);
      setLinesCleared(nextLinesTotal);

      gridRef.current = finalGrid;
      setGrid(finalGrid);
      if (!skipAnimation) {
        isCleaningRef.current = false;
        setIsCleaning(false);
      }

      if (nextLinesTotal >= linesGoal) {
        triggerSprintComplete();
        return;
      }

      const nextType = popNextPieceType();
      canHoldRef.current = true;
      setCanHold(true);
      spawnPiece(nextType, finalGrid);
    } else {
      gridRef.current = updatedGrid;
      setGrid(updatedGrid);
      const nextType = popNextPieceType();
      canHoldRef.current = true;
      setCanHold(true);
      spawnPiece(nextType, updatedGrid);
    }
  };

  const lockCurrentPiece = (piece) => {
    if (!piece || lockingInProgressRef.current || isMatchEnded() || isGameplayBlocked()) return;
    lockingInProgressRef.current = true;
    inputLockedRef.current = true;
    clearHorizontalPrimaryDir(handlingStateRef.current);
    clearLockTimeout();
    void processLanding(piece);
  };

  const startLockTimer = (piece, delayMs = 300) => {
    if (
      lockingInProgressRef.current ||
      isMatchEnded() ||
      inputLockedRef.current ||
      isGameplayBlocked()
    ) {
      return;
    }
    clearLockTimeout.setTimer(piece, delayMs, lockCurrentPiece);
  };

  const handleStartMatch = () => {
    clearLockTimeout();
    clearCleanTimeout();
    lockingInProgressRef.current = false;
    inputLockedRef.current = false;

    const freshQueue = buildInitialQueue(nextCount + 8);
    const firstType = freshQueue[0];
    const nextBag = freshQueue.slice(1);
    const emptyGrid = createEmptyGrid(totalRows, cols);
    const initialPiece = createSpawnPiece(pieces, firstType, spawnX);

    resetStatsTracker(statsRef.current);
    syncStatsState();

    isGameOverRef.current = false;
    setIsGameOver(false);
    isSprintCompleteRef.current = false;
    setIsSprintComplete(false);
    isClutchRef.current = false;
    setIsClutch(false);
    isCleaningRef.current = false;
    setIsCleaning(false);
    isGroundedRef.current = false;
    setIsGrounded(false);
    moveResetsRef.current = 0;
    setMoveResets(0);
    holdPieceRef.current = null;
    setHoldPiece(null);
    canHoldRef.current = true;
    setCanHold(true);

    gridRef.current = emptyGrid;
    setGrid(emptyGrid);
    bagRef.current = nextBag;
    setBag(nextBag);
    nextPiecesRef.current = nextBag.slice(0, nextCount);
    activePieceRef.current = initialPiece;
    setActivePiece(initialPiece);

    setHasStarted(true);
    hasStartedRef.current = true;
    syncSceneRender();
    startCountdown();
  };

  const handleCloseConfig = () => {
    setIsConfigOpen(false);
    isConfigOpenRef.current = false;
    if (hasStartedRef.current && !isMatchEnded()) {
      startCountdown();
    }
  };

  const resetGame = () => {
    if (isGameplayBlocked()) return;
    clearLockTimeout();
    clearCleanTimeout();
    lockingInProgressRef.current = false;
    inputLockedRef.current = false;
    resetInputState(true);

    resetStatsTracker(statsRef.current);
    syncStatsState();

    const emptyGrid = createEmptyGrid(totalRows, cols);

    isGameOverRef.current = false;
    setIsGameOver(false);
    isSprintCompleteRef.current = false;
    setIsSprintComplete(false);
    isClutchRef.current = false;
    setIsClutch(false);
    isCleaningRef.current = false;
    setIsCleaning(false);
    isGroundedRef.current = false;
    setIsGrounded(false);
    moveResetsRef.current = 0;
    setMoveResets(0);
    holdPieceRef.current = null;
    setHoldPiece(null);
    canHoldRef.current = true;
    setCanHold(true);
    bagRef.current = [];
    setBag([]);
    nextPiecesRef.current = [];
    gridRef.current = emptyGrid;
    setGrid(emptyGrid);
    activePieceRef.current = null;
    setActivePiece(null);
    setCountdown(null);
    countdownRef.current = null;
    setHasStarted(false);
    hasStartedRef.current = false;
    syncSceneRender();
  };

  const applyPlayerMoveSync = (moveHandlerFn, { countAsInput = true } = {}) => {
    const currentPiece = activePieceRef.current;
    const currentGrid = gridRef.current;
    if (
      !currentPiece ||
      isCleaningRef.current ||
      isMatchEnded() ||
      isGameplayBlocked() ||
      lockingInProgressRef.current ||
      inputLockedRef.current
    ) {
      return false;
    }

    const candidate = moveHandlerFn(currentGrid, currentPiece);
    if (!candidate) return false;

    if (!hasPieceChanged(currentPiece, candidate)) return false;

    if (countAsInput) {
      recordPieceInput(statsRef.current, 1);
    }

    activePieceRef.current = candidate;
    setActivePiece(candidate);

    const testDown = moveFn(currentGrid, candidate, 0, 1);
    const isNowGrounded = testDown.pos.y === candidate.pos.y;

    if (isNowGrounded) {
      isGroundedRef.current = true;
      setIsGrounded(true);

      const nextResets = moveResetsRef.current + 1;
      moveResetsRef.current = nextResets;
      setMoveResets(nextResets);

      if (nextResets >= maxLockResets) {
        inputLockedRef.current = true;
        clearHorizontalPrimaryDir(handlingStateRef.current);
        syncSceneRender();
        lockCurrentPiece(candidate);
        return true;
      }

      startLockTimer(candidate, 450);
    } else if (isGroundedRef.current) {
      isGroundedRef.current = false;
      setIsGrounded(false);
      clearLockTimeout();
    }

    syncSceneRender();
    return true;
  };

  const handleHardDropSync = (computeHardDropPieceFn) => {
    const currentPiece = activePieceRef.current;
    const currentGrid = gridRef.current;
    if (
      !currentPiece ||
      isCleaningRef.current ||
      isMatchEnded() ||
      isGameplayBlocked() ||
      lockingInProgressRef.current ||
      inputLockedRef.current
    ) {
      return;
    }

    inputLockedRef.current = true;
    clearHorizontalPrimaryDir(handlingStateRef.current);
    clearLockTimeout();
    isGroundedRef.current = false;
    setIsGrounded(false);
    moveResetsRef.current = 0;
    setMoveResets(0);

    const current = computeHardDropPieceFn(currentGrid, currentPiece, moveFn);

    activePieceRef.current = current;
    setActivePiece(current);
    syncSceneRender();
    lockCurrentPiece(current);
  };

  const handleHoldSync = () => {
    const currentPiece = activePieceRef.current;
    if (
      !canPerformHold({
        currentPiece,
        isCleaning: isCleaningRef.current,
        isMatchEnded: isMatchEnded(),
        isGameplayBlocked: isGameplayBlocked(),
        canHold: canHoldRef.current,
        lockingInProgress: lockingInProgressRef.current,
        inputLocked: inputLockedRef.current,
      })
    ) {
      return;
    }

    recordPieceInput(statsRef.current, 1);
    clearLockTimeout();
    isGroundedRef.current = false;
    setIsGrounded(false);
    moveResetsRef.current = 0;
    setMoveResets(0);
    canHoldRef.current = false;
    setCanHold(false);

    const { nextHoldPiece, pieceToSpawn } = resolveHoldPiece({
      currentPiece,
      holdPiece: holdPieceRef.current,
      popNextPieceType,
    });

    holdPieceRef.current = nextHoldPiece;
    setHoldPiece(nextHoldPiece);
    spawnPiece(pieceToSpawn, gridRef.current);
  };

  return {
    triggerTopOut,
    triggerSprintComplete,
    spawnPiece,
    popNextPieceType,
    lockPieceToGrid,
    processLanding,
    lockCurrentPiece,
    startLockTimer,
    handleStartMatch,
    handleCloseConfig,
    resetGame,
    applyPlayerMoveSync,
    handleHardDropSync,
    handleHoldSync,
  };
}
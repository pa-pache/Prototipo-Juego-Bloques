import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PIECES } from '../utils/constants/pieces';
import { move, try_rotate, getGhostPiece } from '../utils/PropsPiece';
import { createGamePlayer } from '../utils/renderer';
import Config, {
  useGameSettings
} from '../UI/Config';

import {
  getTopoutZoneCells,
  buildInitialQueue,
  getVisibleNextPieces,
  popNextPieceFromBag,
} from './mechanics/nextPieces';

import { canPerformHold, resolveHoldPiece } from './mechanics/hold';

import {
  createHandlingState,
  resetHandlingState,
  clearHorizontalPrimaryDir,
  isAnyKeyPressed,
  setKeyPressedState,
  ensureHeldHorizontalDir,
  handleHorizontalKeyDown,
  handleSoftDropKeyDown,
  handleHorizontalKeyUp,
  stepHandlingFrame,
} from './mechanics/handling';

import {
  createStatsTracker,
  resetStatsTracker,
  getStatsSnapshot,
  computePps,
  recordPieceInput,
  resetPieceInputs,
  recordPiecePlacedAndFinesse,
  addClearedLines,
  stepActiveTime,
  pauseFrameTimer,
  resumeFrameTimer,
} from './mechanics/stats';

import { findFullLines, clearLinesSequence } from './mechanics/clear';

import {
  createSpawnPiece,
  canSpawnAtPosition,
  hasPieceChanged,
  computeHardDropPiece,
  lockPieceIntoGrid,
  toVisibleHandPiece,
} from './mechanics/activePiece';

import {
  createEmptyGrid,
  getVisibleBoardGrid,
  hasReachedMinRowForTopoutPreview,
  touchesTopoutZone,
} from './mechanics/grid';

import { createMatchHandlers } from './mechanics/handlers';

const MAX_LOCK_RESETS = 15;
const BUFFER_ROWS = 2;
const LINES_GOAL = 40;
const SPAWN_X = 3;
const COUNTDOWN_SECONDS = 3;
// Zona de topout sobre la grilla visible (filas superiores 0 y 1 del tablero, no sobre el buffer)
const TOPOUT_VISIBLE_ROWS = [0, 1];
// Mínimo de altura en la grilla visible para mostrar la pieza próxima en la zona de topout (fila 4 -> índice 3)
const MIN_ROW_FOR_TOPOUT_PREVIEW = 3;

export default function GamePlayer() {
  const gameSettings = useGameSettings();

  // Ajustes de velocidad (en ms):
  // DAS: delay antes de repetir lateralmente (ej. 80 - 150 ms)
  // ARR: intervalo entre repeticiones laterales (0 = instantáneo, >0 = deslizado)
  // SOFT_DROP_ARR: intervalo entre caídas al mantener el input del soft drop
  const das = gameSettings.das;
  const arr = gameSettings.arr;
  const softDropArr = gameSettings.softDrop;
  const nextCount = gameSettings.nextCount;

  const rows = 20;
  const cols = 10;
  const totalRows = rows + BUFFER_ROWS;

  const settingsRef = useRef(gameSettings);
  settingsRef.current = gameSettings;
  const controls = gameSettings.controls;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const [hasStarted, setHasStarted] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const isConfigOpenRef = useRef(isConfigOpen);
  isConfigOpenRef.current = isConfigOpen;

  const [grid, setGrid] = useState(() => createEmptyGrid(totalRows, cols));

  const [bag, setBag] = useState([]);
  const [holdPiece, setHoldPiece] = useState(null);
  const [canHold, setCanHold] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isSprintComplete, setIsSprintComplete] = useState(false);
  const [isClutch, setIsClutch] = useState(false);

  // Métricas Sprint (40L)
  const [piecesPlaced, setPiecesPlaced] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pps, setPps] = useState(0);
  const [finesseFaults, setFinesseFaults] = useState(0);
  const [finesseAccuracy, setFinesseAccuracy] = useState(100);

  const [isGrounded, setIsGrounded] = useState(false);
  const [moveResets, setMoveResets] = useState(0);
  const lockTimeoutRef = useRef(null);
  const lockDeadlineRef = useRef(null);
  const lockRemainingMsRef = useRef(null);
  const cleanTimeoutRef = useRef(null);
  const lockingInProgressRef = useRef(false);
  const inputLockedRef = useRef(false);

  // Tracker y refs para tiempo, PPS, líneas y finesse
  const statsRef = useRef(createStatsTracker());
  const isWindowFocusedRef = useRef(typeof document !== 'undefined' ? document.hasFocus() : true);

  const canvasHostRef = useRef(null);
  const sceneRef = useRef(null);

  const [activePiece, setActivePiece] = useState(null);

  const gridRef = useRef(grid);
  const bagRef = useRef(bag);
  const holdPieceRef = useRef(holdPiece);
  const canHoldRef = useRef(canHold);
  const isCleaningRef = useRef(isCleaning);
  const isGameOverRef = useRef(isGameOver);
  const isSprintCompleteRef = useRef(isSprintComplete);
  const isClutchRef = useRef(isClutch);
  const activePieceRef = useRef(activePiece);
  const isGroundedRef = useRef(isGrounded);
  const moveResetsRef = useRef(moveResets);
  const dasRef = useRef(das);
  const arrRef = useRef(arr);
  const elapsedMsRef = useRef(elapsedMs);
  const ppsRef = useRef(pps);
  const finesseAccuracyRef = useRef(finesseAccuracy);
  const hasStartedRef = useRef(hasStarted);
  const countdownRef = useRef(countdown);

  gridRef.current = grid;
  bagRef.current = bag;
  holdPieceRef.current = holdPiece;
  canHoldRef.current = canHold;
  isCleaningRef.current = isCleaning;
  isGameOverRef.current = isGameOver;
  isSprintCompleteRef.current = isSprintComplete;
  isClutchRef.current = isClutch;
  activePieceRef.current = activePiece;
  isGroundedRef.current = isGrounded;
  moveResetsRef.current = moveResets;
  dasRef.current = das;
  arrRef.current = arr;
  elapsedMsRef.current = elapsedMs;
  ppsRef.current = pps;
  finesseAccuracyRef.current = finesseAccuracy;
  hasStartedRef.current = hasStarted;
  countdownRef.current = countdown;

  const isMatchEnded = () => isGameOverRef.current || isSprintCompleteRef.current;
  const isGameplayBlocked = () =>
    isConfigOpenRef.current || !hasStartedRef.current || countdownRef.current !== null;

  const nextPieces = useMemo(() => {
    return getVisibleNextPieces({ hasStarted, bag, nextCount });
  }, [bag, nextCount, hasStarted]);

  const nextPiecesRef = useRef(nextPieces);
  nextPiecesRef.current = nextPieces;

  const handlingStateRef = useRef(createHandlingState());

  const syncStatsState = useCallback(() => {
    const snap = getStatsSnapshot(statsRef.current);
    elapsedMsRef.current = snap.elapsedMs;
    ppsRef.current = snap.pps;
    finesseAccuracyRef.current = snap.finesseAccuracy;
    setPiecesPlaced(snap.piecesPlaced);
    setLinesCleared(snap.linesCleared);
    setElapsedMs(snap.elapsedMs);
    setPps(snap.pps);
    setFinesseFaults(snap.finesseFaults);
    setFinesseAccuracy(snap.finesseAccuracy);
  }, []);

  const recalculatePps = useCallback(() => {
    computePps(statsRef.current);
    syncStatsState();
  }, [syncStatsState]);

  const syncSceneRender = useCallback(() => {
    if (!sceneRef.current) return;
    const showActive =
      hasStartedRef.current &&
      !isCleaningRef.current &&
      !isMatchEnded() &&
      Boolean(activePieceRef.current);
    const currentGrid = gridRef.current;
    const visibleBoardGrid = getVisibleBoardGrid(currentGrid, BUFFER_ROWS);
    const currentActive = showActive ? activePieceRef.current : null;
    const visibleActivePiece = currentActive
      ? toVisibleHandPiece(currentActive, BUFFER_ROWS)
      : null;
    const visibleGhostPiece = currentActive
      ? getGhostPiece(currentGrid, currentActive, BUFFER_ROWS)
      : null;

    const showTopoutNextPreview =
      hasStartedRef.current &&
      !isCleaningRef.current &&
      !isMatchEnded() &&
      hasReachedMinRowForTopoutPreview(visibleBoardGrid, MIN_ROW_FOR_TOPOUT_PREVIEW);

    sceneRef.current.render({
      grid: visibleBoardGrid,
      activePiece: visibleActivePiece,
      ghostPiece: visibleGhostPiece,
      holdPiece: holdPieceRef.current,
      nextPieces: nextPiecesRef.current,
      pieces: PIECES,
      showTopoutNextPreview,
      pps: ppsRef.current,
      elapsedMs: elapsedMsRef.current,
      linesCleared: statsRef.current.linesCleared,
      finesseFaults: statsRef.current.finesseFaults,
      finesseAccuracy: finesseAccuracyRef.current,
    });
  }, []);

  const syncSceneRenderRef = useRef(syncSceneRender);
  syncSceneRenderRef.current = syncSceneRender;

  // Cuando cambie apariencia o nextCount mientras estás en el tablero, redibuja al instante:
  useEffect(() => {
    syncSceneRender();
  }, [gameSettings.nextCount, syncSceneRender]);

  const clearLockTimeout = () => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    lockDeadlineRef.current = null;
    lockRemainingMsRef.current = null;
  };
  clearLockTimeout.setTimer = (piece, delayMs, onLock) => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    lockRemainingMsRef.current = null;
    lockDeadlineRef.current = performance.now() + delayMs;
    lockTimeoutRef.current = setTimeout(() => {
      onLock(piece);
    }, delayMs);
  };

  const clearCleanTimeout = () => {
    if (cleanTimeoutRef.current) {
      clearTimeout(cleanTimeoutRef.current);
      cleanTimeoutRef.current = null;
    }
  };
  clearCleanTimeout.cleanTimeoutRef = cleanTimeoutRef;

  const resetInputState = (clearKeys = false) => {
    resetHandlingState(handlingStateRef.current, clearKeys);
  };

  const startCountdown = useCallback(() => {
    if (isMatchEnded()) return;
    pauseFrameTimer(statsRef.current);
    resetInputState(true);
    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = COUNTDOWN_SECONDS;
  }, []);

  const handlers = createMatchHandlers({
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
    pieces: PIECES,
    spawnX: SPAWN_X,
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
    bufferRows: BUFFER_ROWS,
    topoutVisibleRows: TOPOUT_VISIBLE_ROWS,
    getTopoutZoneCells,
    settingsRef,
    clearLinesSequence,
    addClearedLines,
    setLinesCleared,
    linesGoal: LINES_GOAL,
    clearHorizontalPrimaryDir,
    maxLockResets: MAX_LOCK_RESETS,
    hasPieceChanged,
    recordPieceInput,
    moveFn: move,
    canPerformHold,
    resolveHoldPiece,
  });

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const {
    lockCurrentPiece,
    handleStartMatch,
    handleCloseConfig,
    resetGame,
    applyPlayerMoveSync,
    handleHardDropSync,
    handleHoldSync,
  } = handlers;

  // Avanza la cuenta regresiva segundo a segundo
  useEffect(() => {
    if (countdown === null || isConfigOpen) return;

    const timer = setTimeout(() => {
      if (countdown > 1) {
        const nextVal = countdown - 1;
        setCountdown(nextVal);
        countdownRef.current = nextVal;
      } else {
        setCountdown(null);
        countdownRef.current = null;
        pauseFrameTimer(statsRef.current);

        if (
          !isMatchEnded() &&
          !isCleaningRef.current &&
          !lockingInProgressRef.current &&
          !inputLockedRef.current &&
          isGroundedRef.current &&
          activePieceRef.current &&
          typeof lockRemainingMsRef.current === 'number'
        ) {
          const remaining = lockRemainingMsRef.current;
          const piece = activePieceRef.current;
          lockRemainingMsRef.current = null;
          lockDeadlineRef.current = performance.now() + remaining;
          lockTimeoutRef.current = setTimeout(() => {
            handlersRef.current?.lockCurrentPiece?.(piece);
          }, remaining);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isConfigOpen]);

  // Limpia teclas presionadas al cambiar la configuración de controles para evitar teclas fantasma
  useEffect(() => {
    resetHandlingState(handlingStateRef.current, true);
  }, [controls]);

  // Al abrir Config: detiene todo movimiento/cronómetro/lock delay y limpia estados de teclas
  useEffect(() => {
    pauseFrameTimer(statsRef.current);
    resetInputState(true);

    if (isConfigOpen && lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
      if (typeof lockDeadlineRef.current === 'number') {
        lockRemainingMsRef.current = Math.max(0, lockDeadlineRef.current - performance.now());
      }
      lockDeadlineRef.current = null;
    }
  }, [isConfigOpen]);

  // Gravedad automática
  useEffect(() => {
    if (
      isCleaning ||
      isGameOver ||
      isSprintComplete ||
      isConfigOpen ||
      !hasStarted ||
      countdown !== null
    ) {
      return;
    }

    const interval = setInterval(() => {
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

      const nextPos = move(currentGrid, currentPiece, 0, 1);
      const touchingGround = nextPos.pos.y === currentPiece.pos.y;

      if (!touchingGround) {
        activePieceRef.current = nextPos;
        setActivePiece(nextPos);
        if (isGroundedRef.current) {
          isGroundedRef.current = false;
          setIsGrounded(false);
          clearLockTimeout();
        }
        syncSceneRender();
        return;
      }

      if (moveResetsRef.current >= MAX_LOCK_RESETS) {
        inputLockedRef.current = true;
        clearHorizontalPrimaryDir(handlingStateRef.current);
        handlersRef.current?.lockCurrentPiece?.(currentPiece);
        return;
      }

      if (!isGroundedRef.current || !lockTimeoutRef.current) {
        isGroundedRef.current = true;
        setIsGrounded(true);
        handlersRef.current?.startLockTimer?.(currentPiece, 350);
      }
    }, 850);

    return () => clearInterval(interval);
  }, [
    isCleaning,
    isGameOver,
    isSprintComplete,
    isConfigOpen,
    hasStarted,
    countdown,
    syncSceneRender,
  ]);

  // Listener de teclado + blur/focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      const activeCtrl = controlsRef.current;
      const key = e.key.toLowerCase();

      if (isConfigOpenRef.current) {
        return;
      }

      if (key === activeCtrl.pause) {
        if (!hasStartedRef.current) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        resetInputState(true);
        setIsConfigOpen(true);
        return;
      }

      if (countdownRef.current !== null || !hasStartedRef.current) {
        return;
      }

      if (key === activeCtrl.reset) {
        resetGame();
        return;
      }

      if (
        [
          activeCtrl.hardDrop,
          activeCtrl.rotateCW,
          activeCtrl.rotateCCW,
          activeCtrl.softDrop,
          activeCtrl.moveLeft,
          activeCtrl.moveRight,
          activeCtrl.hold,
          activeCtrl.reset,
        ].includes(key)
      ) {
        e.preventDefault();
      }

      if (isAnyKeyPressed(handlingStateRef.current, key)) return;
      setKeyPressedState(handlingStateRef.current, key, true);

      if (isMatchEnded()) {
        return;
      }

      const now = performance.now();

      if (key === activeCtrl.moveLeft || key === activeCtrl.moveRight) {
        handleHorizontalKeyDown({
          handlingState: handlingStateRef.current,
          key,
          controls: activeCtrl,
          das: dasRef.current,
          now,
          canMove:
            !isCleaningRef.current && !inputLockedRef.current && !lockingInProgressRef.current,
          onMoveHorizontal: (dx) => {
            applyPlayerMoveSync((g, p) => move(g, p, dx, 0), {
              countAsInput: true,
            });
          },
        });
        return;
      }

      if (isCleaningRef.current || inputLockedRef.current || lockingInProgressRef.current) {
        return;
      }

      if (key === activeCtrl.softDrop) {
        handleSoftDropKeyDown({
          handlingState: handlingStateRef.current,
          softDropArr,
          now,
          onMoveDown: () => {
            applyPlayerMoveSync((g, p) => move(g, p, 0, 1), { countAsInput: false });
          },
        });
      } else if (key === activeCtrl.rotateCW) {
        applyPlayerMoveSync((g, p) => try_rotate(g, p, 'CW'), { countAsInput: true });
      } else if (key === activeCtrl.rotateCCW) {
        applyPlayerMoveSync((g, p) => try_rotate(g, p, 'CCW'), { countAsInput: true });
      } else if (key === activeCtrl.hardDrop) {
        handleHardDropSync(computeHardDropPiece);
      } else if (key === activeCtrl.hold) {
        handleHoldSync();
      }
    };

    const handleKeyUp = (e) => {
      const activeCtrl = controlsRef.current;
      const key = e.key.toLowerCase();
      setKeyPressedState(handlingStateRef.current, key, false);

      handleHorizontalKeyUp({
        handlingState: handlingStateRef.current,
        key,
        controls: activeCtrl,
        das: dasRef.current,
        isMatchEnded: isMatchEnded(),
        isGameplayBlocked: isGameplayBlocked(),
        canMove:
          !isCleaningRef.current && !inputLockedRef.current && !lockingInProgressRef.current,
        onMoveHorizontal: (dx) => {
          applyPlayerMoveSync((g, p) => move(g, p, dx, 0), { countAsInput: true });
        },
      });
    };

    const handleWindowBlur = () => {
      isWindowFocusedRef.current = false;
      pauseFrameTimer(statsRef.current);
      resetInputState(true);
    };

    const handleWindowFocus = () => {
      isWindowFocusedRef.current = true;
      resumeFrameTimer(statsRef.current, performance.now());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [
    controls,
    softDropArr,
    resetGame,
    applyPlayerMoveSync,
    handleHardDropSync,
    handleHoldSync,
  ]);

  // Bucle principal por frame: acumula tiempo activo, actualiza PPS y ejecuta DAS / ARR
  useEffect(() => {
    let animationFrameId;

    const updateMovement = (now) => {
      if (isGameplayBlocked()) {
        pauseFrameTimer(statsRef.current);
        animationFrameId = requestAnimationFrame(updateMovement);
        return;
      }

      const shouldAccumulateTime =
        !isMatchEnded() &&
        !isCleaningRef.current &&
        isWindowFocusedRef.current;

      const prevElapsed = statsRef.current.elapsedMs;
      const prevPps = statsRef.current.pps;
      stepActiveTime(statsRef.current, now, shouldAccumulateTime);
      if (
        statsRef.current.elapsedMs !== prevElapsed ||
        statsRef.current.pps !== prevPps
      ) {
        syncStatsState();
      }

      if (!isMatchEnded()) {
        stepHandlingFrame({
          handlingState: handlingStateRef.current,
          now,
          controls: controlsRef.current,
          das: dasRef.current,
          arr: arrRef.current,
          softDropArr,
          canRepeatMove: () =>
            !isCleaningRef.current &&
            !lockingInProgressRef.current &&
            !inputLockedRef.current,
          onMoveHorizontal: (dx) =>
            applyPlayerMoveSync((g, p) => move(g, p, dx, 0), {
              countAsInput: false,
            }),
          onMoveDown: () =>
            applyPlayerMoveSync((g, p) => move(g, p, 0, 1), {
              countAsInput: false,
            }),
        });
      }

      animationFrameId = requestAnimationFrame(updateMovement);
    };

    animationFrameId = requestAnimationFrame(updateMovement);
    return () => cancelAnimationFrame(animationFrameId);
  }, [controls, softDropArr, syncStatsState, applyPlayerMoveSync]);

  useEffect(() => {
    return () => {
      clearLockTimeout();
      clearCleanTimeout();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let createdScene = null;
    const container = canvasHostRef.current;
    if (!container) return;

    createGamePlayer({
      containerEl: container,
      rows,
      cols,
      cellSize: 26,
      nextCount: settingsRef.current.nextCount,
      bufferRows: BUFFER_ROWS,
      linesGoal: LINES_GOAL,
    })
      .then((scene) => {
        if (!active) {
          scene?.destroy?.();
          return;
        }
        createdScene = scene;
        sceneRef.current = scene;
        syncSceneRenderRef.current?.();
      })
      .catch((err) => {
        console.error('[GamePlayer] Error inicializando PixiJS:', err);
      });

    return () => {
      active = false;
      sceneRef.current = null;
      if (createdScene) {
        createdScene.destroy?.();
      }
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [cols, rows]);

  useEffect(() => {
    syncSceneRender();
  }, [
    grid,
    activePiece,
    holdPiece,
    nextPieces,
    isCleaning,
    isGameOver,
    isSprintComplete,
    isClutch,
    pps,
    elapsedMs,
    linesCleared,
    finesseFaults,
    finesseAccuracy,
    syncSceneRender,
  ]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={canvasHostRef}
        style={{ pointerEvents: isConfigOpen ? 'none' : 'auto' }}
      />

      {!hasStarted && !isConfigOpen && !isGameOver && !isSprintComplete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
          }}
        >
          <button
            type="button"
            onClick={handleStartMatch}
            style={{
              padding: '14px 28px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Iniciar partida
          </button>
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            style={{
              padding: '14px 28px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Configuración
          </button>
        </div>
      )}

      {countdown !== null && !isConfigOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 550,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '64px',
              fontWeight: '800',
              color: '#ffffff',
              lineHeight: 1,
            }}
          >
            {countdown}
          </span>
        </div>
      )}

      {isConfigOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
          }}
        >
          <Config onClose={handleCloseConfig} />
        </div>
      )}
    </div>
  );
}
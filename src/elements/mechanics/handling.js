export function createHandlingState() {
  return {
    keysPressed: {},
    primaryHorizontalDir: null,
    moveTimers: { horizontal: 0, down: 0 },
  };
}

export function resetHandlingState(handlingState, clearKeys = false) {
  if (clearKeys) {
    handlingState.keysPressed = {};
  }
  handlingState.primaryHorizontalDir = null;
  handlingState.moveTimers.horizontal = 0;
  handlingState.moveTimers.down = 0;
}

export function clearHorizontalPrimaryDir(handlingState) {
  handlingState.primaryHorizontalDir = null;
}

export function isAnyKeyPressed(handlingState, key) {
  return Boolean(handlingState.keysPressed[key]);
}

export function setKeyPressedState(handlingState, key, pressed) {
  handlingState.keysPressed[key] = pressed;
}

export function ensureHeldHorizontalDir({
  handlingState,
  controls,
  das,
  isGameplayBlocked,
  now = performance.now(),
}) {
  if (isGameplayBlocked) return;
  const leftHeld = Boolean(handlingState.keysPressed[controls.moveLeft]);
  const rightHeld = Boolean(handlingState.keysPressed[controls.moveRight]);
  const currentDir = handlingState.primaryHorizontalDir;

  if (currentDir === 'left' && leftHeld) return;
  if (currentDir === 'right' && rightHeld) return;

  if (leftHeld && !rightHeld) {
    handlingState.primaryHorizontalDir = 'left';
    handlingState.moveTimers.horizontal = now + das;
  } else if (rightHeld && !leftHeld) {
    handlingState.primaryHorizontalDir = 'right';
    handlingState.moveTimers.horizontal = now + das;
  } else if (!leftHeld && !rightHeld) {
    handlingState.primaryHorizontalDir = null;
  }
}

export function handleHorizontalKeyDown({
  handlingState,
  key,
  controls,
  das,
  now,
  canMove,
  onMoveHorizontal,
}) {
  const dir = key === controls.moveLeft ? 'left' : 'right';
  if (!handlingState.primaryHorizontalDir) {
    handlingState.primaryHorizontalDir = dir;
    handlingState.moveTimers.horizontal = now + das;
    if (canMove) {
      onMoveHorizontal(dir === 'left' ? -1 : 1);
    }
  }
}

export function handleSoftDropKeyDown({
  handlingState,
  softDropArr,
  now,
  onMoveDown,
}) {
  handlingState.moveTimers.down = now + softDropArr;
  onMoveDown();
}

export function handleHorizontalKeyUp({
  handlingState,
  key,
  controls,
  das,
  isMatchEnded,
  isGameplayBlocked,
  canMove,
  onMoveHorizontal,
  now = performance.now(),
}) {
  if (isMatchEnded || isGameplayBlocked) {
    if (key === controls.moveLeft && handlingState.primaryHorizontalDir === 'left') {
      handlingState.primaryHorizontalDir = null;
    } else if (key === controls.moveRight && handlingState.primaryHorizontalDir === 'right') {
      handlingState.primaryHorizontalDir = null;
    }
    return;
  }

  if (key === controls.moveLeft && handlingState.primaryHorizontalDir === 'left') {
    if (handlingState.keysPressed[controls.moveRight]) {
      handlingState.primaryHorizontalDir = 'right';
      handlingState.moveTimers.horizontal = now + das;
      if (canMove) {
        onMoveHorizontal(1);
      }
    } else {
      handlingState.primaryHorizontalDir = null;
    }
  } else if (key === controls.moveRight && handlingState.primaryHorizontalDir === 'right') {
    if (handlingState.keysPressed[controls.moveLeft]) {
      handlingState.primaryHorizontalDir = 'left';
      handlingState.moveTimers.horizontal = now + das;
      if (canMove) {
        onMoveHorizontal(-1);
      }
    } else {
      handlingState.primaryHorizontalDir = null;
    }
  }
}

export function stepHandlingFrame({
  handlingState,
  now,
  controls,
  das,
  arr,
  softDropArr,
  canRepeatMove,
  onMoveHorizontal,
  onMoveDown,
}) {
  let primaryDir = handlingState.primaryHorizontalDir;
  if (!primaryDir) {
    if (handlingState.keysPressed[controls.moveLeft]) {
      handlingState.primaryHorizontalDir = 'left';
      handlingState.moveTimers.horizontal = now + das;
      primaryDir = 'left';
    } else if (handlingState.keysPressed[controls.moveRight]) {
      handlingState.primaryHorizontalDir = 'right';
      handlingState.moveTimers.horizontal = now + das;
      primaryDir = 'right';
    }
  }

  const primaryKey =
    primaryDir === 'left'
      ? controls.moveLeft
      : primaryDir === 'right'
      ? controls.moveRight
      : null;

  if (
    canRepeatMove() &&
    primaryKey &&
    handlingState.keysPressed[primaryKey] &&
    now >= handlingState.moveTimers.horizontal
  ) {
    const stepInterval = Math.max(0, arr);
    handlingState.moveTimers.horizontal = now + stepInterval;

    if (stepInterval === 0) {
      let moved = true;
      while (moved && canRepeatMove()) {
        moved = onMoveHorizontal(primaryDir === 'left' ? -1 : 1);
      }
    } else {
      onMoveHorizontal(primaryDir === 'left' ? -1 : 1);
    }
  }

  if (
    canRepeatMove() &&
    handlingState.keysPressed[controls.softDrop] &&
    now >= handlingState.moveTimers.down
  ) {
    const downInterval = Math.max(0, softDropArr);
    handlingState.moveTimers.down = now + downInterval;

    if (downInterval === 0) {
      let dropped = true;
      while (dropped && canRepeatMove()) {
        dropped = onMoveDown();
      }
    } else {
      onMoveDown();
    }
  }
}
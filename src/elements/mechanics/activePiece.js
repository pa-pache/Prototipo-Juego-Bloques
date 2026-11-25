export function createSpawnPiece(pieces, pieceType, spawnX) {
  const piece = pieces[pieceType];
  const x = pieceType === 'O' ? spawnX + 1 : spawnX;
  return {
    pos: { x, y: 0 },
    type: pieceType,
    shape: piece.shape,
    rotacion: '0',
  };
}

export function canSpawnAtPosition(currentGrid, piece, cols) {
  if (!piece || !piece.shape) return false;

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x] !== 0) {
        const targetX = piece.pos.x + x;
        const targetY = piece.pos.y + y;

        if (targetX < 0 || targetX >= cols || targetY < 0 || targetY >= currentGrid.length) {
          return false;
        }

        if (currentGrid[targetY]?.[targetX] !== 0) {
          return false;
        }
      }
    }
  }

  return true;
}

export function hasPieceChanged(currentPiece, candidate) {
  if (!candidate || !currentPiece) return false;
  return (
    candidate.pos.x !== currentPiece.pos.x ||
    candidate.pos.y !== currentPiece.pos.y ||
    candidate.rotacion !== currentPiece.rotacion ||
    candidate.shape !== currentPiece.shape
  );
}

export function computeHardDropPiece(currentGrid, currentPiece, moveFn) {
  let current = { ...currentPiece };
  let dropped = moveFn(currentGrid, current, 0, 1);

  while (dropped && dropped.pos.y !== current.pos.y) {
    current = dropped;
    dropped = moveFn(currentGrid, current, 0, 1);
  }

  return current;
}

export function lockPieceIntoGrid(currentGrid, piece, cols) {
  if (!piece || !piece.shape) return currentGrid;

  const newGrid = currentGrid.map((row) => [...row]);
  piece.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) {
        const targetY = piece.pos.y + y;
        const targetX = piece.pos.x + x;
        if (targetY >= 0 && targetY < newGrid.length && targetX >= 0 && targetX < cols) {
          newGrid[targetY][targetX] = piece.type;
        }
      }
    });
  });

  return newGrid;
}

export function toVisibleHandPiece(piece, bufferRows) {
  if (!piece || !piece.shape) return null;
  return {
    ...piece,
    pos: {
      x: piece.pos.x,
      y: piece.pos.y - bufferRows,
    },
  };
}
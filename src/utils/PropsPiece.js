import { WALL_KICKS_JLSTZ, WALL_KICKS_I } from './constants/kicks';

const ROTATIONS = ['0', 'R', '2', 'L'];
const O_KICKS = [[0, 0]];

export function move(grid, piece, dx, dy) {
  if (!piece || !piece.shape) return piece;

  const new_x = piece.pos.x + dx;
  const new_y = piece.pos.y + dy;

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x] !== 0) {
        const gridX = new_x + x;
        const gridY = new_y + y;

        if (
          gridX < 0 ||
          gridX >= grid[0].length ||
          gridY < 0 ||
          gridY >= grid.length ||
          grid[gridY][gridX] !== 0
        ) {
          return piece;
        }
      }
    }
  }

  return {
    ...piece,
    pos: { x: new_x, y: new_y },
  };
}

export function rotate_cw(shape) {
  return shape[0].map((_, colIndex) =>
    shape.map((row) => row[colIndex]).reverse()
  );
}

export function rotate_ccw(shape) {
  return shape[0]
    .map((_, colIndex) => shape.map((row) => row[colIndex]))
    .reverse();
}

export function try_rotate(grid, piece, direccion) {
  if (!piece || !piece.shape) return piece;

  const currentState = piece.rotacion || '0';
  const currentIndex = ROTATIONS.indexOf(currentState);
  const newIndex =
    direccion === 'CW' ? (currentIndex + 1) % 4 : (currentIndex + 3) % 4;
  const newState = ROTATIONS[newIndex];

  const nuevaForma =
    direccion === 'CW' ? rotate_cw(piece.shape) : rotate_ccw(piece.shape);

  const transitionKey = `${currentState}->${newState}`;
  const offsets =
    piece.type === 'O'
      ? O_KICKS
      : piece.type === 'I'
      ? WALL_KICKS_I[transitionKey] || [[0, 0]]
      : WALL_KICKS_JLSTZ[transitionKey] || [[0, 0]];

  for (const [kickX, kickY] of offsets) {
    const new_x = piece.pos.x + kickX;
    const new_y = piece.pos.y - kickY; // En SRS +Y es hacia arriba, en matrices +Y es hacia abajo

    let isValid = true;

    for (let y = 0; y < nuevaForma.length; y++) {
      for (let x = 0; x < nuevaForma[y].length; x++) {
        if (nuevaForma[y][x] !== 0) {
          const gridX = new_x + x;
          const gridY = new_y + y;

          if (
            gridX < 0 ||
            gridX >= grid[0].length ||
            gridY < 0 ||
            gridY >= grid.length ||
            grid[gridY][gridX] !== 0
          ) {
            isValid = false;
            break;
          }
        }
      }
      if (!isValid) break;
    }

    if (isValid) {
      return {
        ...piece,
        shape: nuevaForma,
        pos: { x: new_x, y: new_y },
        rotacion: newState,
      };
    }
  }

  return piece;
}

export function hard_drop(grid, piece) {
  let currentPiece = piece;
  let nextPos = move(grid, currentPiece, 0, 1);

  while (nextPos.pos.y !== currentPiece.pos.y) {
    currentPiece = nextPos;
    nextPos = move(grid, currentPiece, 0, 1);
  }

  return block_piece(grid, currentPiece);
}

export function falling_piece(grid, piece) {
  return move(grid, piece, 0, 1);
}

function lock_delay(grid, piece) {
  const piece_drop = move(grid, piece, 0, 1);
  return piece_drop.pos.y === piece.pos.y;
}

export function block_piece(grid, piece) {
  if (!lock_delay(grid, piece)) {
    return null;
  }

  const newGrid = grid.map((fila) => [...fila]);

  piece.shape.forEach((fila, y) => {
    fila.forEach((valor, x) => {
      if (valor !== 0) {
        const posY = y + piece.pos.y;
        const posX = x + piece.pos.x;

        if (
          posY >= 0 &&
          posY < newGrid.length &&
          posX >= 0 &&
          posX < newGrid[0].length
        ) {
          newGrid[posY][posX] = piece.type;
        }
      }
    });
  });

  return newGrid;
}

export const getGhostPiece = (grid, piece, bufferRows = 0) => {
  if (!piece || !piece.shape) return null;
  let ghost = { ...piece, pos: { ...piece.pos } };

  let nextPos = move(grid, ghost, 0, 1);
  while (nextPos.pos.y !== ghost.pos.y) {
    ghost = nextPos;
    nextPos = move(grid, ghost, 0, 1);
  }

  if (bufferRows > 0) {
    return {
      ...ghost,
      pos: { x: ghost.pos.x, y: ghost.pos.y - bufferRows },
    };
  }

  return ghost;
};
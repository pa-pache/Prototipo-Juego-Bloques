class piecesBag {
  constructor() {
    this.pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  }

  // Baraja un array usando Fisher-Yates
  shuffle(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Devuelve un NUEVO ARRAY con las 7 piezas barajadas
  getNewBag() {
    return this.shuffle(this.pieces);
  }
}

const bagInstance = new piecesBag();

// Retorna el ARRAY de 7 piezas ordenadas de forma aleatoria
export const getBag = () => {
  return bagInstance.getNewBag();
};
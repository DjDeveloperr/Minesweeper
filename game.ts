export function indexToPosition(size: number, index: number): [number, number] {
  return [index % size, Math.floor(index / size)];
}

export function positionToIndex(size: number, x: number, y: number) {
  return x + y * size;
}

export function isValidIndex(size: number, index: number) {
  return index >= 0 && index < (size ** 2);
}

/** Represents the State of the Game instance */
export enum State {
  /** Game is yet being played */
  Playing,
  /** Game has ended in a Win (All squares revealed except Mines) */
  Win,
  /** Game has ended in a Lose (Mine revealed) */
  Lose,
}

/** Represents a Minesweeper Game instance */
export class Minesweeper {
  #data: Uint8Array;
  #dataView: DataView;
  map: Uint8Array;

  /** Returns Deserializable Data */
  get data() {
    return this.#data.slice(0);
  }

  get #state(): State {
    return this.#dataView.getUint8(8);
  }

  set #state(state: State) {
    this.#dataView.setUint8(8, state);
  }

  get flag(): boolean {
    return this.#dataView.getUint8(9) === 1;
  }

  set flag(flag: boolean) {
    this.#dataView.setUint8(9, Number(flag));
  }

  get #revealed() {
    return this.#dataView.getUint32(15);
  }

  set #revealed(value: number) {
    this.#dataView.setUint32(15, value);
  }

  get #flagged() {
    return this.#dataView.getUint32(11);
  }

  set #flagged(value: number) {
    this.#dataView.setUint32(11, value);
  }

  get size() {
    return this.#dataView.getUint8(10);
  }

  get revealed() {
    return this.#revealed;
  }

  get flagged() {
    return this.#flagged;
  }

  get state() {
    return this.#state;
  }

  get user(): bigint {
    return this.#dataView.getBigInt64(0);
  }

  constructor(data: Uint8Array);
  constructor(size: number, user: bigint);
  constructor(sizeOrData: number | Uint8Array, user?: bigint) {
    if (sizeOrData instanceof Uint8Array) {
      this.#data = sizeOrData.slice(1);
      this.#dataView = new DataView(this.#data.buffer);
    } else {
      const size = sizeOrData;
      this.#data = new Uint8Array(
        8 + // user (snowflake bigint)
          1 + // state (u8) offset 8
          1 + // flag enabled (u8) offset 9
          1 + // size (u8) offset 10
          4 + // flagged (u32) offset 11
          4 + // revealed (u32) offset 15
          (size ** 2), // map (n bytes) offset 11
      );

      this.#dataView = new DataView(this.#data.buffer);
      this.#dataView.setBigInt64(0, user!);
      this.#dataView.setUint8(10, size);
    }

    this.map = new Uint8Array(this.#data.buffer, 19, this.size ** 2);

    if (typeof sizeOrData === "number") this.#setupMap();
  }

  #setupMap() {
    const mines = this.size; // Math.floor((90 / 100) * this.size);
    const minePositions = new Set<number>();

    while (minePositions.size < mines) {
      const position = Math.floor(Math.random() * (this.size ** 2));
      minePositions.add(position);
    }

    minePositions.forEach((position) => {
      this.map[position] = 9;
    });

    this.map.forEach((e, i) => {
      if (e !== 9) {
        this.map[i] = this.#around(i).map((e) =>
          this.map[e]
        ).filter((e) => e === 9).length;
      }
    });

    const zeroes = [...this.map].map((e, i) => ({ e, i })).filter((e) =>
      e.e === 0
    ).map((e) => e.i);
    const rand = zeroes[Math.floor(Math.random() * zeroes.length)];
    this.#revealAdd(rand);
  }

  #revealAdd(cell: number) {
    this.#revealed |= (1 << cell);
  }

  isRevealed(cell: number) {
    return (this.revealed & (1 << cell)) === (1 << cell);
  }

  #flagAdd(cell: number) {
    this.#flagged |= (1 << cell);
  }

  #flagRemove(cell: number) {
    this.#flagged &= ~(1 << cell);
  }

  isFlagged(cell: number) {
    return (this.flagged & (1 << cell)) === (1 << cell);
  }

  #around(cell: number) {
    const [x, y] = indexToPosition(this.size, cell);

    const around = [];
    for (let ax = -1; ax <= 1; ax++) {
      for (let ay = -1; ay <= 1; ay++) {
        const nx = x + ax;
        const ny = y + ay;
        if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;
        const idx = positionToIndex(this.size, x + ax, y + ay);
        if (isValidIndex(this.size, idx)) {
          around.push(idx);
        }
      }
    }

    return around;
  }

  #checkEnded() {
    const notRevealed: number[] = [];

    for (const _ in this.map) {
      const i = Number(_);
      const e = this.map[i];
      if (!this.isRevealed(i)) notRevealed.push(e);
      else if (e === 9) {
        this.#state = State.Lose;
        return;
      }
    }

    if (notRevealed.every((e) => e === 9)) this.#state = State.Win;
  }

  click(cell: number) {
    if (this.#state !== State.Playing) {
      throw new Error(`Cannot click, game is not in Playing State`);
    }

    if (!isValidIndex(this.size, cell)) {
      throw new RangeError(`Cell ${cell} is not in range of 0-24`);
    }

    if (this.isRevealed(cell)) {
      if (this.flag) return;
      const around = this.#around(cell);
      around.forEach((e) => {
        if (!this.isRevealed(e) && !this.isFlagged(e)) {
          this.#revealAdd(e);
        }
      });
      this.#checkEnded();
      return;
    }

    if (this.flag) {
      if (this.isFlagged(cell)) this.#flagRemove(cell);
      else this.#flagAdd(cell);
    } else {
      if (this.isFlagged(cell)) return;
      this.#revealAdd(cell);
    }

    this.#checkEnded();
  }
}

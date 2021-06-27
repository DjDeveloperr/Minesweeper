import * as slash from "./deps.ts";

const TOKEN = Deno.env.get("TOKEN")!;
const PUBLIC_KEY = Deno.env.get("PUBLIC_KEY")!;

slash.init({ token: TOKEN, publicKey: PUBLIC_KEY });

export enum Cell {
  None,
  One,
  Two,
  Three,
  Bomb,
  Flag,
}

// Game is 35 bytes, stored in customID of the
// cells of Minesweeper buttons. While the flag
// button (which is a followup), stores user id
// id (8*2 bytes) and token (AES encrypted)
// of interaction in its customID.
export interface Game {
  header: 0; // 1 byte header. 0 = cell button, 1 = flag button (it has different layout)
  current: number; // for cell, its index. for flag, it's current state (0 = disabled, 1 = enabled)
  // below 3 are only present on cell. for flag its id and token bytes
  user: bigint; // 8 bytes
  cells: Uint8Array; // 25 bytes
  flag: number; // 1 byte
}

/** Utility methods to Serialize/Deserialize Game state */
export const GAME = {
  /** Serialize Game object into Uint8Array */
  serialize: (game: Game): Uint8Array => {
    const data = new Uint8Array(36);
    const view = new DataView(data.buffer);

    data[1] = game.current;
    view.setBigUint64(0, game.user);
    data.set(game.cells, 8);
    view.setUint8(33, game.flag);

    return data;
  },
  /** Deserialize Game object from Uint8Array */
  deserialize: (data: Uint8Array): Game => {
    const view = new DataView(data.buffer);
    return {
      header: view.getUint8(0) as 0,
      current: view.getUint8(1),
      user: view.getBigUint64(1),
      cells: data.subarray(1 + 8, 1 + 8 + 25),
      flag: view.getUint8(1 + 8 + 25),
    };
  },
};

export function encode(str: string): Uint8Array {
  return (Deno as any).core.encode(str);
}

export function decode(data: Uint8Array): string {
  return (Deno as any).core.decode(data);
}

const TOKEN_BYTES = encode(Deno.env.get("CRYPTO_KEY") ?? TOKEN);
const iv = new Uint8Array(16);

/** Encrypt Interaction token with Client Token (or CRYPTO_KEY env if present) */
export function encrypt(token: string) {
  const cipher = new slash.Cbc(slash.Aes, TOKEN_BYTES, iv, slash.Padding.PKCS7);
  return cipher.encrypt(encode(token));
}

/** Decrypt Interaction token with Client Token (or CRYPTO_KEY env if present) */
export function decrypt(data: Uint8Array) {
  const cipher = new slash.Cbc(
    slash.Aes,
    TOKEN_BYTES,
    iv,
    slash.Padding.PKCS7,
  );
  return decode(cipher.decrypt(data));
}

export function indexToPosition(index: number): [number, number] {
  return [index % 5, Math.floor(index / 5)];
}

export function positionToIndex(x: number, y: number) {
  return x + y * 5;
}

export function isValidIndex(index: number) {
  return index >= 0 && index < 25;
}

export enum End {
  None,
  Win,
  Lose,
}

/** Checks if Game has Ended, if it did, a Win or Lose */
export function checkEnd(game: Game): End {
  for (const _ of game.cells) {
    const i = Number(_);
    const e: Cell = game.cells[i];

    // If cell is None continue
    if (e === Cell.None || e === Cell.Flag) continue;
    // If cell is Bomb then return Lose
    if (e === Cell.Bomb) return End.Lose;

    const [x, y] = indexToPosition(i);
    const surround: Cell[] = [];

    // All surrounding positions
    const arr = [
      positionToIndex(x - 1, y),
      positionToIndex(x + 1, y),
      positionToIndex(x, y - 1),
      positionToIndex(x, y + 1),
    ];

    let addedRevealedLength = 0;
    for (const e of arr) {
      // Check if its in bounds
      if (isValidIndex(e)) {
        const cell = game.cells[e];
        // If its a bomb (not caught by previous check yet) then return Lose
        if (cell === Cell.Bomb) return End.Lose;
        surround.push(cell);
      } else addedRevealedLength++;
    }

    const revealed = surround.filter((e) => e !== Cell.None && e !== Cell.Flag);
    // If there are some cells left around with bomb possibility then return None
    if ((revealed.length + addedRevealedLength) < e) return End.None;
  }

  // It's a win!
  return End.Win;
}

export const BOMB = "💣";
export const FLAG = "🚩";

export function Components(game: Game): {
  content: string;
  components: slash.MessageComponentData[];
} {
  const end = checkEnd(game);

  const components = slash.chunkArray(
    [...game.cells].map((e: Cell, i) => {
      const data = GAME.serialize(game);
      data[1] = i;
      return ({
        type: 2,
        label: e === Cell.None
          ? "\u200b"
          : e === Cell.One
          ? "1"
          : e === Cell.Two
          ? "2"
          : e === Cell.Three
          ? "3"
          : "",
        style: e === Cell.One || e === Cell.Two || e === Cell.Three
          ? 1
          : e === Cell.Bomb
          ? 4
          : e === Cell.Flag
          ? 3
          : 2,
        emoji: e === Cell.Bomb ? { name: BOMB }
        : e === Cell.Flag ? { name: FLAG } : undefined,
        customID: decode(data),
        disabled: end === End.None ? false : true,
      });
    }),
    5,
  ).map((e): slash.MessageComponentData => ({ type: 1, components: e }));

  return {
    content: `State: ${End[end] == "None" ? "Playing" : End[end]}`,
    components,
  };
}

slash.handle("minesweeper", (d) => {});

slash.client.on("interaction", async (d) => {
  try {
    if (slash.isMessageComponentInteraction(d) && d.componentType === 2) {
      const data = encode(d.customID);

      if (data[0] === 0x0) {
        // header is cell button
        const game = GAME.deserialize(data);
        if (String(game.user) !== d.user.id) return d.respond({ type: 6 });
        const idx = game.current;
        if (game.cells[idx] !== Cell.None) return d.respond({ type: 6 });
        if (game.flag === 1) {
          game.cells[idx] = Cell.Flag;
        } else {
        }
        await d.respond({ type: 7, ...Components(game) });
      } else if (data[0] === 0x1) {
        // header is flag button
        const state = data[1];
        data[1] ^= 1;
        const view = new DataView(data.buffer);
        const userID = view.getBigUint64(2);
        if (String(userID) !== d.user.id) return d.respond({ type: 6 });
        const token = decrypt(data.slice(2 + 8 + 8));

        slash.client.rest.request(
          "get",
          `/webhooks/${d.applicationID}/${token}/messages/@original`,
        ).then((e: slash.MessagePayload) => {
          if (!e.components) return;
          if (
            e.components?.some((e) => e.components?.some((e) => e.disabled))
          ) {
            return;
          }
          e.components = e.components.map((e) => {
            if (!e.components) return e;
            e.components = e.components.map((e) => {
              const data = encode(e.custom_id!);
              data[1 + 8 + 25] = state;
              e.custom_id = decode(data);
              return e;
            });
            return e;
          });
          return slash.client.rest.request(
            "patch",
            `/webhooks/${d.applicationID}/${token}/messages/@original`,
            { data: { components: e.components } },
          );
        }).catch(() => {});

        await d.respond({
          type: 7,
          content: "\u200b",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: state == 0 ? "Off" : "On",
                  style: state == 0 ? 4 : 3,
                  customID: decode(data),
                },
              ],
            },
          ],
        });
      }
    }
  } catch (e) {
    console.error(e);
  }
});

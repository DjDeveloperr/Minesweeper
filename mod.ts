// doesn't work
import * as slash from "./deps.ts";

const TOKEN = Deno.env.get("TOKEN")!;

slash.init({ env: true });

const commands: slash.SlashCommandPartial[] = [
  {
    name: "minesweeper",
    description: "Start playing Minesweeper!",
  },
  {
    name: "invite",
    description: "Invite me to your server!",
  },
];

export enum Cell {
  None,
  One,
  Two,
  Three,
  Zero,
  Bomb,
  Flag,
}

// Game is 35 bytes, stored in customID of the
// cells of Minesweeper buttons. While the flag
// button (which is a followup), stores user id
// id (8*2 bytes) and token (AES encrypted)
// of interaction in its customID.
export interface Game {
  header: 0; // 1 byte header. 0 = cell button, 1 = flag button (it has different layout), 2 = leave (kind of similar to flag)
  current: number; // for cell, its index. for flag, it's current state (0 = disabled, 1 = enabled). for leave, its 0.
  // below 3 are only present on cell. for flag and exit its id and token bytes
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
    view.setBigUint64(2, game.user);
    data.set(game.cells, 2 + 8);
    view.setUint8(2 + 8 + 25, game.flag);

    return data;
  },
  /** Deserialize Game object from Uint8Array */
  deserialize: (data: Uint8Array): Game => {
    const view = new DataView(data.buffer);
    return {
      header: view.getUint8(0) as 0,
      current: view.getUint8(1),
      user: view.getBigUint64(2),
      cells: data.subarray(2 + 8, 2 + 8 + 25),
      flag: view.getUint8(2 + 8 + 25),
    };
  },
};

export function encode(str: Uint8Array): string {
  return slash.encodeToString(str);
}

export function decode(data: string): Uint8Array {
  return slash.decodeString(data);
}

const TOKEN_BYTES: Uint8Array = (Deno as any).core.encode(
  (Deno.env.get("CRYPTO_KEY") ?? TOKEN).substr(0, 32),
);
const iv = new Uint8Array(16);

/** Encrypt Interaction token with Client Token (or CRYPTO_KEY env if present) */
export function encrypt(token: string) {
  const cipher = new slash.Cbc(slash.Aes, TOKEN_BYTES, iv, slash.Padding.PKCS7);
  return cipher.encrypt((Deno as any).core.encode(token));
}

/** Decrypt Interaction token with Client Token (or CRYPTO_KEY env if present) */
export function decrypt(data: Uint8Array) {
  const cipher = new slash.Cbc(
    slash.Aes,
    TOKEN_BYTES,
    iv,
    slash.Padding.PKCS7,
  );
  return (Deno as any).core.decode(cipher.decrypt(data));
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
  if (game.cells.every((e) => e === Cell.None)) return End.None;

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
    const arr = [];

    for (let ax = -1; ax <= 1; ax++) {
      for (let ay = -1; ay <= 1; ay++) {
        arr.push(positionToIndex(x + ax, y + ay));
      }
    }

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

  const data = GAME.serialize(game);
  const components = slash.chunkArray(
    [...game.cells].map((e: Cell, i) => {
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
          : e === Cell.Zero
          ? "0"
          : "",
        style: e === Cell.Zero || e === Cell.One || e === Cell.Two ||
            e === Cell.Three
          ? 1
          : e === Cell.Bomb
          ? 4
          : e === Cell.Flag
          ? 3
          : 2,
        emoji: e === Cell.Bomb ? { name: BOMB }
        : e === Cell.Flag ? { name: FLAG } : undefined,
        customID: encode(data),
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

slash.handle("minesweeper", async (d) => {
  const game: Game = {
    user: BigInt(d.user.id),
    header: 0,
    current: 0,
    cells: new Uint8Array(25),
    flag: 0,
  };

  const token = encrypt(d.token);
  console.log("encrypted token", token);
  const data = new Uint8Array(1 + 1 + 8 + token.length);
  data[0] = 1;
  const view = new DataView(data.buffer);
  view.setBigUint64(1 + 1, BigInt(d.user.id));
  data.set(token, 1 + 1 + 8);

  await d.reply(Components(game));
  await d.send({
    content: "\u200b",
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: "Off",
            style: 4,
            emoji: { name: FLAG },
            customID: encode(data),
          },
        ],
      },
    ],
  });
});

slash.client.on("interaction", async (d) => {
  console.log("Interaction (" + d.type + ") By " + d.user.tag, d.data);
  try {
    console.log(d.type, (d as any).componentType);
    if (slash.isMessageComponentInteraction(d) && d.componentType === 2) {
      const data = decode(d.customID);
      console.log("Custom ID Data", data);

      if (data[0] === 0x0) {
        // header is cell button
        const game = GAME.deserialize(data);
        console.log("Game", game);
        if (String(game.user) !== d.user.id) return d.respond({ type: 6 });
        const idx = game.current;
        if (
          game.cells[idx] !== Cell.None && game.cells[idx] !== Cell.Flag &&
          game.flag !== 1
        ) {
          return d.respond({ type: 6 });
        }
        if (game.flag === 1) {
          game.cells[idx] = game.cells[idx] === Cell.Flag
            ? Cell.None
            : Cell.Flag;
        } else {
          game.cells[idx] = Math.floor(Math.random() * 4 + 1);
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
              const data = decode(e.custom_id!);
              data[1 + 8 + 25] = state;
              e.custom_id = encode(data);
              return e;
            });
            return e;
          });
          return slash.client.rest.request(
            "patch",
            `/webhooks/${d.applicationID}/${token}/messages/@original`,
            { data: { components: e.components } },
          );
        }).catch(() => console.error);

        await d.respond({
          type: 7,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: state == 0 ? "Off" : "On",
                  style: state == 0 ? 4 : 3,
                  emoji: { name: FLAG },
                  customID: encode(data),
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

const INVITE =
  "https://discord.com/api/oauth2/authorize?client_id=858682973800497172&scope=applications.commands";

slash.handle("invite", (d) => {
  return d.reply(
    `• [Click here to invite.](<${INVITE}>)\n• [Support on Ko-fi.](<https://ko-fi.com/DjDeveloper>)\n• [Made by DjDeveloper#7777](<https://discord.com/users/422957901716652033>)`,
    { ephemeral: true },
  );
});

slash.client.on("interactionError", console.error);

slash.commands.all().then((e) => {
  if (e.size !== commands.length) return slash.commands.bulkEdit(commands);
}).catch(console.error);

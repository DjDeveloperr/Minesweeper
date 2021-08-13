import * as slash from "./deps.ts";
import { MessageComponentData } from "./deps.ts";
import { Minesweeper, State } from "./game.ts";

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
  {
    name: "Toggle Flag",
    type: "MESSAGE",
  },
];

const MINE = "💣";
const FLAG = "🚩";

function GameMessage(game: Minesweeper) {
  let i = -1;

  return {
    content: game.state === State.Lose
      ? `Game has ended, <@${game.user}> lost!`
      : game.state === State.Win
      ? `Game has ended, <@${game.user}> won!`
      : `${FLAG} **Flag:** ${game.flag ? "On" : "Off"}\n`,
    components: slash.chunkArray([...game.map], 5).map((e) =>
      <MessageComponentData> ({
        type: 1,
        components: e.map((e) => (<MessageComponentData> {
          type: 2,
          style: game.isFlagged(++i)
            ? "GREEN"
            : game.isRevealed(i)
            ? (e === 9 ? "RED" : "GREY")
            : "BLURPLE",
          label: game.isFlagged(i) || !game.isRevealed(i) || (game.isRevealed(i) && e === 9) ? "" : e,
          emoji: e === 9 && game.isRevealed(i) ? { name: MINE } : game.isFlagged(i)
            ? { name: FLAG }
            : !game.isRevealed(i)
            ? { id: "741616560061415504" }
            : undefined,
          customID: slash.encodeToString(new Uint8Array([...game.data, i])),
        })),
      })
    ),
    allowedMentions: { parse: [] },
  };
}

slash.handle("minesweeper", (d) => {
  const game = new Minesweeper(5, BigInt(d.user.id));
  return d.reply(GameMessage(game));
});

slash.handle("Toggle Flag", (d) => {
  if (
    !d.targetMessage || d.targetMessage.author.id !== slash.client.getID() ||
    !d.targetMessage.components.length ||
    !d.targetMessage.components[0].customID
  ) {
    return d.reply("You can't do it on this message!", { ephemeral: true });
  }

  const game = new Minesweeper(
    slash.decodeString(
      d.targetMessage.components[0].components?.[0]?.customID!,
    ),
  );
  if (d.user.id !== game.user.toString()) {
    return d.reply("nope", { ephemeral: true });
  }

  const components = d.targetMessage.components.map((e) => {
    if (e.components) {
      e.components = e.components.map((e) => {
        const game = new Minesweeper(slash.decodeString(e.customID!));
        game.flag = !game.flag;
        e.customID = slash.encodeToString(game.data);
        return e;
      });
    }
    return e;
  });

  return slash.client.rest.endpoints.editMessage(
    d.targetMessage.channelID,
    d.targetMessage.id,
    {
      components: slash.transformComponent(components),
    },
  ); // .catch(() => {});
}, "MESSAGE");

slash.client.on("interaction", async (d) => {
  try {
    if (d.isMessageComponent() && d.componentType === 2) {
      const game = new Minesweeper(slash.decodeString(d.customID));
      if (game.user.toString() !== d.user.id) return d.respond({ type: 7 });
      try {
        game.click(game.data[game.data.length - 1]);
      } catch (e) {}
      return d.respond({ type: 6, ...GameMessage(game) });
    } else return d.reply("nope " + d.isMessageComponent() + ", " + (d as any).componentType + ", " + Deno.inspect(d.data) + ", " + d.constructor.name, { ephemeral: true });
  } catch (e) {
    console.error("Error at interaction event:", e);
  }
});

const INVITE =
  "https://discord.com/api/oauth2/authorize?client_id=874879655511982110&scope=applications.commands";

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

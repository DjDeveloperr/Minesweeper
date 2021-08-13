import * as slash from "./deps.ts";
import { MessageComponentData, MessageComponentPayload } from "./deps.ts";
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
    components: slash.chunkArray([...game.map], game.size).map((e) =>
      <MessageComponentData> ({
        type: 1,
        components: e.map((e) => (<MessageComponentData> {
          type: 2,
          style: game.isFlagged(++i)
            ? "GREEN"
            : game.isRevealed(i)
            ? (e === 9 ? "RED" : "GREY")
            : "BLURPLE",
          label: game.isFlagged(i) || !game.isRevealed(i) ||
              (game.isRevealed(i) && e === 9)
            ? ""
            : e.toString(),
          emoji: e === 9 && game.isRevealed(i)
            ? { name: MINE }
            : game.isFlagged(i)
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

slash.handle("Toggle Flag", async (d) => {
  const comps =
    d.targetMessage?.components as unknown as MessageComponentPayload[] ?? [];
  if (
    !d.targetMessage || d.targetMessage.author.id !== slash.client.getID() ||
    !comps[0].components?.[0]?.custom_id
  ) {
    return d.reply(
      "You can't do it on this message!",
      { ephemeral: true },
    );
  }

  const game = new Minesweeper(
    slash.decodeString(
      comps[0].components?.[0]?.custom_id!,
    ),
  );

  game.flag = !game.flag;

  if (d.user.id !== game.user.toString()) {
    return d.reply("Nope", { ephemeral: true });
  }

  await d.defer(true);

  const { content, components } = GameMessage(game);

  return slash.client.rest.endpoints.editMessage(
    d.data.resolved?.messages?.[d.targetMessage.id].channel_id!,
    d.targetMessage.id,
    {
      content,
      components: slash.transformComponent(components),
    },
  ).then(() => d.editResponse("Toggled flag!")).catch((e) =>
    d.editResponse("Failed to toggle flag! " + e)
  );
}, "MESSAGE");

slash.client.on("interaction", async (d) => {
  try {
    if (d.isMessageComponent() && d.data.component_type === 2) {
      const game = new Minesweeper(slash.decodeString(d.data.custom_id));
      if (game.user.toString() !== d.user.id) {
        return d.respond({ type: 6 });
      }
      const cell = game.data[game.data.length - 1];
      try {
        game.click(cell);
      } catch (e) {
        console.error("game.click error", e);
      }
      
      return d.respond({
        type: 7,
        ...GameMessage(game),
      });
    }
  } catch (e) {
    console.error("Error at interaction event:", e);
  }
});

const INVITE = "https://discord.com/api/oauth2/authorize?client_id=" +
  slash.client.getID() + "&scope=applications.commands";

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

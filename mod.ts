import {
  client,
  commands as slashCommands,
  decodeString,
  encodeToString,
  handle,
  init,
  MessageComponentData,
  MessagePayload,
  SlashCommandPartial,
  transformComponent,
} from "./deps.ts";
import { Minesweeper, State } from "./game.ts";

init({ env: true });

const commands: SlashCommandPartial[] = [
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

export function chunkArray<T>(arr: T[], perChunk: number): T[][] {
  return arr.reduce((resultArray: T[][], item, index) => {
    const chunkIndex = Math.floor(index / perChunk);

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [];
    }

    resultArray[chunkIndex].push(item);

    return resultArray;
  }, []);
}

function GameMessage(game: Minesweeper) {
  let i = -1;

  return {
    content: game.state === State.Lose
      ? `Game has ended, <@${game.user}> lost!`
      : game.state === State.Win
      ? `Game has ended, <@${game.user}> won!`
      : `${FLAG} **Flag:** ${game.flag ? "On" : "Off"}\n`,
    components: chunkArray([...game.map], game.size).map((e) =>
      <MessageComponentData> ({
        type: 1,
        components: e.map((e) => {
          i++;
          return <MessageComponentData> {
            type: 2,
            style: game.isFlagged(i)
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
            customID: encodeToString(
              new Uint8Array([...game.data.slice(0, game.byteLength), i]),
            ),
            disabled: game.state !== State.Playing,
          };
        }),
      })
    ),
  };
}

handle("minesweeper", (d) => {
  const game = new Minesweeper(5, BigInt(d.user.id));
  return d.reply(GameMessage(game));
});

handle("Toggle Flag", async (d) => {
  if (!d.targetMessage) return;
  // resolved fields are not serialized to Message in serverless environment
  const targetMessage = d.targetMessage as unknown as MessagePayload;
  const comps = targetMessage.components ?? [];

  if (
    d.targetMessage.author.id !== client.getID() ||
    !comps[0].components?.[0]?.custom_id
  ) {
    return d.reply(
      "You can't do it on this message!",
      { ephemeral: true },
    );
  }

  const game = new Minesweeper(
    decodeString(
      comps[0].components?.[0]?.custom_id!,
    ),
  );

  game.flag = !game.flag;

  if (d.user.id !== game.user.toString()) {
    return d.reply("Nope", { ephemeral: true });
  }

  await d.defer(true);

  const { content, components } = GameMessage(game);

  return client.rest.endpoints.editMessage(
    d.data.resolved?.messages?.[d.targetMessage.id].channel_id!,
    d.targetMessage.id,
    {
      content,
      components: transformComponent(components),
    },
  ).then(() => d.editResponse("Toggled flag!")).catch((e) =>
    d.editResponse(("Failed to toggle flag! " + e).substr(0, 2000))
  );
}, "MESSAGE");

client.on("interaction", async (d) => {
  try {
    if (d.isMessageComponent() && d.data.component_type === 2) {
      const game = new Minesweeper(decodeString(d.data.custom_id));
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
  client.getID() + "&scope=applications.commands+bot&permissions=2048";

handle("invite", (d) => {
  return d.reply(
    `• [Click here to invite.](<${INVITE}>)\n• [Support me on Ko-fi.](<https://ko-fi.com/DjDeveloper>)\n• [Check out the Source](<https://github.com/DjDeveloperr/Minesweeper>)\n• [Made by DjDeveloper#7777](<https://discord.com/users/422957901716652033>)`,
    { ephemeral: true },
  );
});

client.on("interactionError", console.error);

slashCommands.all().then((e) => {
  if (e.size !== commands.length) return slashCommands.bulkEdit(commands);
}).catch(console.error);

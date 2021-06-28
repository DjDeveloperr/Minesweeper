import {
  Client,
  isMessageComponentInteraction,
  BotUI,
  fragment,
  ActionRow,
  Button,
} from "https://raw.githubusercontent.com/harmonyland/harmony/b3e83aa639a117c438a509db1c064d59e29e5be9/mod.ts";
import { chunkArray } from "https://crux.land/chunk@1.0.0";
import { TOKEN } from "./config.ts";
import { Minesweeper, State } from "./engine.ts";

const client = new Client({
  token: TOKEN,
  intents: ["GUILDS"],
});

const games = new Map<string, [string, Minesweeper]>();

export const BOMB = "💣";
export const FLAG = "🚩";

export function GameComponent({ nonce, game }: { nonce: string, game: Minesweeper }) {
  let i = -1;
  return <>
    {...chunkArray([...game.map], game.size).map((e) => {
      return <ActionRow>
        {...e.map((e) => {
          i++;
          return <Button
            id={`cell::${nonce}::${i}`}
            style={game.isFlagged(i) ? "green" : game.isRevealed(i) ? (e === 9 ? "red" : "blurple") : "grey"}
            label={game.isFlagged(i) ? "" : game.isRevealed(i) ? (e === 9 ? "" : e.toString()) : "\u200b"}
            emoji={game.isFlagged(i) ? { name: FLAG } : game.isRevealed(i) ? (e === 9 ? { name: BOMB } : undefined) : undefined}
            disabled={game.state !== State.Playing}
          />;
        })}
      </ActionRow>;
    })}
  </>;
}

export function FollowupComponent({ nonce, game }: { nonce: string, game?: Minesweeper }) {
  return <>
    <ActionRow>
      <Button
        id={`flag::${nonce}`}
        label={game?.flag ? "On" : "Off"}
        style={game?.flag ? "green" : "red"}
        emoji={{ name: FLAG }}
        disabled={!game || game?.state !== State.Playing}
      />
      <Button
        id={`leave::${nonce}`}
        label="Leave"
        style="red"
        disabled={!game || game?.state !== State.Playing}
      />
    </ActionRow>
  </>;
}

client.slash.handle("minesweeper", async (d) => {
  if (games.has(d.user.id)) {
    return d.reply("You're already playing! Finish the previous game first.", { ephemeral: true });
  }

  const minesweeper = new Minesweeper(5);
  const nonce = crypto.randomUUID();
  games.set(d.user.id, [nonce, minesweeper]);

  await d.reply({
    content: `<@${d.user.id}> is playing.`,
    allowedMentions: { parse: [] },
    components: <GameComponent
      nonce={nonce}
      game={minesweeper}
    />
  });
  await d.channel?.send("\u200b", {
    components: <FollowupComponent
      nonce={nonce}
      game={minesweeper}
    />
  });
});

client.on("interactionCreate", async (d) => {
  if (isMessageComponentInteraction(d)) {
    const spl = d.customID.split("::");
    const inst = games.get(d.user.id);

    if (!inst) {
      if ((spl[0] == "flag" || spl[0] == "leave") && spl[1]) {
        return d.respond({
          type: 7,
          content: "\u200b",
          components: <FollowupComponent
            nonce={spl[1]}
            game={undefined}
          />,
        });
      }
      return d.respond({ type: 6 });
    }
    const [nonce, game] = inst;
    if (nonce !== spl[1]) return d.respond({ type: 6 });

    if (spl[0] === "cell") {
      const cell = Number(spl[2]);
      game.click(cell);
      if (game.state !== State.Playing) games.delete(d.user.id);
      await d.respond({
        type: 7,
        content: game.state === State.Playing ? `<@${d.user.id}> is playing.` : game.state === State.Win ? `<@${d.user.id}> won!` : `<@${d.user.id}> lost.`,
        allowedMentions: { parse: [] },
        components: <GameComponent
          nonce={nonce}
          game={game}
        />
      });
    } else if (spl[0] === "flag") {
      game.flag = !game.flag;
      await d.respond({
        type: 7,
        content: "\u200b",
        components: <FollowupComponent
          nonce={nonce}
          game={game}
        />,
      });
    } else if (spl[0] === "leave") {
      games.delete(d.user.id);
      await d.respond({
        type: 7,
        content: "You have left the game.",
        components: <FollowupComponent
          nonce={nonce}
          game={undefined}
        />,
      });
    }
  }
});

const INVITE =
  "https://discord.com/api/oauth2/authorize?client_id=858682973800497172&permissions=0&scope=bot%20applications.commands";

client.slash.handle("invite", (d) => {
  return d.reply(
    `• [Click here to invite.](<${INVITE}>)\n• [Support on Ko-fi.](<https://ko-fi.com/DjDeveloper>)\n• [Made by DjDeveloper#7777](<https://discord.com/users/422957901716652033>)`,
    { ephemeral: true },
  );
});

client.slash.on("interactionError", console.error);

client.connect().then(() => console.log("Connected!"));

import * as slash from "./deps.ts";

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
    type: 3,
  } as unknown as slash.SlashCommandPartial, // sorry typescript but shut up
  {
    name: "Leave Game",
    type: 3,
  } as unknown as slash.SlashCommandPartial,
];

slash.client.on("interaction", async (d) => {
  try {
    if (d.isMessageComponent()) {
      if (d.componentType === 2) {

      }
    } else if (d.isSlashCommand() && (d.data as any).target_id) {
      const msg = (d.resolved as any).messages[(d.data as any).target_id];
    }
  } catch(e) {
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

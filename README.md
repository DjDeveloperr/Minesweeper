# Minesweeper

This is yet another Minesweeper but using Buttons (and the new Context Menu
commands :eyes:), but something is different -- it's completely serverless!
Complete state is stored in `custom_id` of Button message component and all
`custom_id`s are patched when it's updated.

You can invite it
[here](https://discord.com/api/oauth2/authorize?client_id=874879655511982110&scope=applications.commands+bot&permissions=2048).

## Deploy it!

Want your own instance of bot? It's easy, navigate to
[this link to Deploy](https://dash.deno.com/new?url=https://raw.githubusercontent.com/DjDeveloperr/Minesweeper/main/mod.ts&env=TOKEN,PUBLIC_KEY)
and fill out `PUBLIC_KEY` and `TOKEN` then deploy! You'll have a link in the end
(ends with `.deno.dev`) which you can set as Interactions Endpoint URL in
Developer Portal.

## But, why bot scope?

Discord doesn't provide us with any way to edit message in response to a Context
Menu command (it would be nice if they allowed type 7 UPDATE_MESSAGE with type 3
MESSAGE application commands). So this bot currently uses a bot user to edit the
message using `PATCH /channels/:id/messages/:id` endpoint.

## License

[MIT Licensed](./LICENSE)

Copyright 2021 (c) DjDeveloperr

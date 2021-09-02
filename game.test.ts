import { Minesweeper, State } from "./game.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.104.0/testing/asserts.ts";

Deno.test("new Minesweeper()", () => {
  const game = new Minesweeper(5, 123n);
  assertEquals(game.state, State.Playing);
  assertEquals(game.flagged, 0);
  assertEquals(game.size, 5);
  assertEquals(game.user, 123n);
  assertEquals(game.flag, false);
  const firstRevealed = [...game.map]
    .map((e, i) => ({ e, i }))
    .filter(({ i }) => game.isRevealed(i))[0].i;
  assertEquals(game.isRevealed(firstRevealed), true);
  assertNotEquals(game.map[firstRevealed], 9);
});

Deno.test("Minesweeper#flag", () => {
  const game = new Minesweeper(5, 123n);
  assertEquals(game.flag, false);
  game.flag = true;
  assertEquals(game.flag, true);
});

Deno.test("Minesweeper#click (non-mine)", () => {
  const game = new Minesweeper(5, 123n);
  const cell = game.map.findIndex((e) => e < 8);
  if (cell === undefined) throw new Error("No cell with value 0 found");
  game.click(cell);
  assertEquals(game.isRevealed(cell), true);
  assertEquals(game.state, State.Playing);
});

Deno.test("Minesweeper#click (mine)", () => {
  const game = new Minesweeper(5, 123n);
  const cell = game.map.findIndex((e) => e === 9);
  if (cell === undefined) throw new Error("No cell with value 9 found");
  game.click(cell);
  assertEquals(game.isRevealed(cell), true);
  assertEquals(game.state, State.Lose);
});

Deno.test("Minesweeper#click (flag)", () => {
  const game = new Minesweeper(5, 123n);
  const cell = game.map.findIndex((e, i) => !game.isRevealed(i) && e === 9);

  game.flag = true;
  
  game.click(cell);
  assertEquals(game.isFlagged(cell), true);
  assertEquals(game.state, State.Playing);
  
  game.click(cell);
  assertEquals(game.isFlagged(cell), false);
  assertEquals(game.state, State.Playing);
  
  game.flag = false;
  
  game.click(cell);
  assertEquals(game.state, State.Lose);
});

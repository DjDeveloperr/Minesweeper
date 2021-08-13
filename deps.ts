export * from "https://raw.githubusercontent.com/DjDeveloperr/harmony/ctx-menu/deploy.ts";
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

export type {
  MessageComponentData,
  MessageComponentType,
} from "https://raw.githubusercontent.com/DjDeveloperr/harmony/ctx-menu/src/types/messageComponents.ts";
export { transformComponent } from "https://raw.githubusercontent.com/DjDeveloperr/harmony/ctx-menu/src/utils/components.ts";
export {
  decodeString,
  encodeToString,
} from "https://deno.land/std@0.99.0/encoding/hex.ts";

import { rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const root = resolve(import.meta.dirname, "../..");
const outputOverride = readArgument("--output");
const packs = outputOverride
  ? [{ name: "Gamemaster Guide", source: "gm-guide", destination: resolve(outputOverride) }]
  : [
      { name: "Gamemaster Guide", source: "gm-guide", destination: join(root, "packs/gm-guide") },
      { name: "Gamemaster Macros", source: "gm-macros", destination: join(root, "packs/gm-macros") }
    ];

for (const pack of packs) {
  if (!resolve(pack.destination).startsWith(`${root}${sep}`)) throw new Error("Pack output must remain inside the repository.");
  await rm(pack.destination, { recursive: true, force: true });
  await compilePack(join(root, "packs-src", pack.source), pack.destination, { log: true, recursive: true });
  console.log(`Built ${pack.name} Compendium in ${pack.destination}`);
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

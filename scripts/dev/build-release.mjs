import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const root = resolve(import.meta.dirname, "../..");
const output = join(root, "dist");
const repository = "JDR-Ninja/fvtt-retro-crt-terminal";
const releaseTag = readArgument("--tag");
const manifest = JSON.parse(await readFile(join(root, "module.json"), "utf8"));
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

if (manifest.version !== packageMetadata.version) {
  throw new Error(`Version mismatch: module.json=${manifest.version}, package.json=${packageMetadata.version}`);
}
if (releaseTag && releaseTag !== `v${manifest.version}`) {
  throw new Error(`Release tag ${releaseTag} must match module version v${manifest.version}`);
}

const tag = releaseTag || `v${manifest.version}`;
await rm(output, { recursive: true, force: true });
await mkdir(join(output, "scripts"), { recursive: true });

const result = await build({
  entryPoints: [join(root, "scripts/main.mjs")],
  outfile: join(output, "scripts/main.min.mjs"),
  bundle: true,
  minify: true,
  legalComments: "none",
  format: "esm",
  platform: "browser",
  target: "es2022",
  metafile: true
});

for (const entry of ["lang", "styles", "templates", "assets", "fonts", "LICENSE", "README.md"]) {
  const source = join(root, entry);
  if (await exists(source)) await cp(source, join(output, entry), { recursive: true });
}
for (const pack of ["gm-guide", "gm-macros"]) {
  await compilePack(join(root, "packs-src", pack), join(output, "packs", pack), { recursive: true });
}

const releaseManifest = {
  ...manifest,
  url: `https://github.com/${repository}`,
  manifest: `https://github.com/${repository}/releases/latest/download/module.json`,
  download: `https://github.com/${repository}/releases/download/${tag}/${manifest.id}.zip`,
  esmodules: ["scripts/main.min.mjs"]
};
await writeFile(join(output, "module.json"), `${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");

const bundle = result.metafile.outputs[relativeOutput("scripts/main.min.mjs")];
console.log(`Built ${manifest.id} ${manifest.version}: ${bundle?.bytes ?? 0} byte JavaScript bundle in dist/.`);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function relativeOutput(path) {
  return join("dist", path).replaceAll("\\", "/");
}

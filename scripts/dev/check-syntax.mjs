import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const ignoredDirectories = new Set([".git", "node_modules", "dist", "release", "coverage"]);
const files = walk(root);
const modules = files.filter(path => extname(path) === ".mjs");

for (const module of modules) execFileSync(process.execPath, ["--check", module], { stdio: "pipe" });

const manifest = readJson(join(root, "module.json"));
const english = readJson(join(root, "lang/en.json"));
const french = readJson(join(root, "lang/fr.json"));

for (const relative of [
  ...manifest.esmodules,
  ...manifest.styles,
  ...manifest.languages.map(language => language.path),
  ...(manifest.packs ?? []).map(pack => pack.path)
]) {
  if (!existsSync(join(root, relative))) throw new Error(`Manifest path does not exist: ${relative}`);
}

const packSources = files.filter(path => path.includes(`${join(root, "packs-src")}`) && extname(path) === ".json");
const packDocuments = packSources.map(path => ({ document: readJson(path), path }));
for (const { document, path } of packDocuments) validatePackSource(document, path);
const packFolders = new Map(packDocuments
  .filter(({ document }) => document._key?.startsWith("!folders!"))
  .map(({ document }) => [document._id, document]));
for (const { document, path } of packDocuments) {
  if (!document.folder || document._key?.startsWith("!folders!")) continue;
  const folder = packFolders.get(document.folder);
  if (!folder) throw new Error(`Missing pack Folder ${document.folder} referenced by ${path}`);
  const expectedType = document._key?.startsWith("!journal!") ? "JournalEntry" : document._key?.startsWith("!macros!") ? "Macro" : null;
  if (expectedType && folder.type !== expectedType) throw new Error(`Folder ${document.folder} has type ${folder.type}, expected ${expectedType} in ${path}`);
}

const localizable = files.filter(path => [".mjs", ".hbs"].includes(extname(path)));
const requiredKeys = new Set();
const ALIAS_DECLARATION = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*"(RETRO_CRT_TERMINAL(?:\.[A-Za-z0-9_-]+)*)";/g;
for (const path of localizable) {
  const source = readFileSync(path, "utf8");
  const aliases = new Map([...source.matchAll(ALIAS_DECLARATION)].map(match => [match[1], match[2]]));
  const expanded = source
    .replace(ALIAS_DECLARATION, "")
    .replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (token, name) => aliases.get(name) ?? token);
  for (const match of expanded.matchAll(/RETRO_CRT_TERMINAL(?:\.[A-Za-z0-9_-]+)+/g)) {
    if (expanded.slice(match.index + match[0].length).startsWith(".${")) continue;
    requiredKeys.add(match[0]);
  }
}
const missing = [];
for (const key of requiredKeys) {
  if (!(key in english)) missing.push(`English: ${key}`);
  if (!(key in french)) missing.push(`French: ${key}`);
}
if (missing.length) throw new Error(`Missing localizations:\n${missing.join("\n")}`);

console.log(`Checked ${modules.length} modules, ${files.filter(path => extname(path) === ".hbs").length} templates, ${packSources.length} pack sources, and ${requiredKeys.size} localization keys.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validatePackSource(document, path) {
  if (document._key?.startsWith("!folders!")) {
    if (document._id?.length !== 16) throw new Error(`Invalid Folder ID in ${path}: ${document._id}`);
    if (!["JournalEntry", "Macro"].includes(document.type)) throw new Error(`Invalid Folder type in ${path}: ${document.type}`);
    if (!String(document.name ?? "").trim()) throw new Error(`Folder name is required in ${path}`);
    return;
  }
  if (document._key?.startsWith("!macros!")) {
    if (document._id?.length !== 16) throw new Error(`Invalid Macro ID in ${path}: ${document._id}`);
    if (document._key !== `!macros!${document._id}`) throw new Error(`Invalid Macro key in ${path}: ${document._key}`);
    if (document.type !== "script") throw new Error(`Invalid Macro type in ${path}: ${document.type}`);
    if (document.scope !== "global") throw new Error(`Invalid Macro scope in ${path}: ${document.scope}`);
    if (!document.command?.startsWith("/**") || !document.command.includes("CONFIGURATION")) {
      throw new Error(`Macro documentation or configuration section is missing in ${path}`);
    }
    try { new AsyncFunction(document.command); }
    catch (error) { throw new Error(`Invalid Macro JavaScript in ${path}: ${error.message}`); }
    return;
  }
  if (!document._key?.startsWith("!journal!")) throw new Error(`Invalid Journal pack key in ${path}`);
  if (document._id?.length !== 16) throw new Error(`Invalid Journal ID in ${path}: ${document._id}`);
  const pageIds = new Set();
  for (const page of document.pages ?? []) {
    if (page._id?.length !== 16) throw new Error(`Invalid page ID in ${path}: ${page._id}`);
    if (pageIds.has(page._id)) throw new Error(`Duplicate page ID in ${path}: ${page._id}`);
    pageIds.add(page._id);
    const expected = `!journal.pages!${document._id}.${page._id}`;
    if (page._key !== expected) throw new Error(`Invalid page key in ${path}: ${page._key}`);
  }
}

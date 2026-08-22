import { diagnostic, screen } from "./ast.mjs";
import { parseInline, UUID_TARGET_PATTERN } from "./inline-parser.mjs";

const BLOCK_DIRECTIVES = new Set(["menu", "login", "effect", "image", "text"]);

export function parseTerminalMarkup(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const children = [];
  const diagnostics = [];

  for (let index = 0; index < lines.length;) {
    const raw = lines[index];
    const trimmed = raw.trim();
    const line = index + 1;

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      children.push({ type: "heading", level: heading[1].length, children: parseInline(heading[2]), location: { line } });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push({ type: "listItem", children: parseInline(lines[index].replace(/^\s*[-*]\s+/, "")), location: { line: index + 1 } });
        index += 1;
      }
      children.push({ type: "list", items, location: { line } });
      continue;
    }

    if (trimmed.startsWith("::")) {
      if (trimmed === "::end") {
        diagnostics.push(diagnostic("Unexpected ::end directive", line));
        index += 1;
        continue;
      }
      const parsed = parseDirectiveHeader(trimmed, line);
      if (!BLOCK_DIRECTIVES.has(parsed.name)) {
        diagnostics.push(diagnostic(`Unknown directive ::${parsed.name}`, line, "warning", "unknown-directive"));
      }
      const body = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "::end") {
        body.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) diagnostics.push(diagnostic(`Unclosed ::${parsed.name} directive`, line, "error", "unclosed-directive"));
      else index += 1;
      children.push(parseDirective(parsed, body, line, diagnostics));
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || next.startsWith("::") || /^(#{1,6})\s+/.test(next) || /^[-*]\s+/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    children.push({ type: "paragraph", children: parseInline(paragraph.join(" ")), location: { line } });
  }

  return screen(children, diagnostics);
}

function parseDirectiveHeader(line, sourceLine) {
  const match = line.match(/^::([\w-]+)(?:\s+(.+))?$/);
  if (!match) return { name: "invalid", argument: "", attributes: {}, location: { line: sourceLine } };
  const tail = match[2] ?? "";
  const attributes = {};
  for (const item of tail.matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g)) {
    attributes[item[1]] = item[2] ?? item[3] ?? item[4] ?? "";
  }
  const argument = tail.replace(/([\w-]+)=(?:"[^"]*"|'[^']*'|[^\s]+)/g, "").trim();
  return { name: match[1], argument, attributes, location: { line: sourceLine } };
}

function parseDirective(header, body, line, diagnostics) {
  switch (header.name) {
    case "menu":
      return parseMenu(header, body, line, diagnostics);
    case "login":
      return { type: "login", ...parseKeyValues(body), attributes: header.attributes, location: { line } };
    case "image":
      return { type: "image", ...parseKeyValues(body), attributes: header.attributes, location: { line } };
    case "effect":
    case "text":
      return { type: "effect", effect: header.argument || header.attributes.effect || "none", children: parseInline(body.join("\n")), location: { line } };
    default:
      return { type: "unknown", name: header.name, source: body.join("\n"), location: { line } };
  }
}

function parseMenu(header, body, line, diagnostics) {
  const mode = header.argument === "children" || header.attributes.mode === "children" ? "children" : "explicit";
  const items = [];
  if (mode === "explicit") {
    for (let offset = 0; offset < body.length; offset += 1) {
      const text = body[offset].trim();
      if (!text) continue;
      const item = parseMenuEntry(text);
      if (!item) {
        diagnostics.push(diagnostic("Invalid menu entry", line + offset + 1, "warning", "invalid-menu-entry"));
        continue;
      }
      items.push(item);
    }
  }
  return { type: "menu", mode, items, location: { line } };
}

function parseMenuEntry(text) {
  const link = text.match(/^\[([^\]]+)\]\((.+)\)$/);
  if (link) return { type: "menuItem", label: link[1], target: link[2] };
  const uuid = text.match(UUID_TARGET_PATTERN);
  if (uuid) return { type: "menuItem", label: uuid[2] ?? "", target: uuid[1] };
  return null;
}

function parseKeyValues(lines) {
  const output = {};
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) output[key] = value;
  }
  return output;
}

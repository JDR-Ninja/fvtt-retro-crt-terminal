const TOKEN_PATTERN = /(@UUID\[[^\]]+\](?:\{[^}]*\})?|\[[^\]]+\]\([^\)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

export const UUID_TARGET_PATTERN = /^(@UUID\[[^\]]+\])(?:\{([^}]*)\})?$/;

export function parseInline(input) {
  const text = String(input ?? "");
  const nodes = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index > cursor) nodes.push({ type: "text", text: text.slice(cursor, match.index) });
    nodes.push(parseToken(match[0]));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push({ type: "text", text: text.slice(cursor) });
  return nodes;
}

function parseToken(token) {
  if (token.startsWith("@UUID[")) {
    const uuid = token.match(UUID_TARGET_PATTERN);
    return { type: "link", label: uuid?.[2] ?? "", target: uuid?.[1] ?? token };
  }
  if (token.startsWith("[")) {
    const match = token.match(/^\[([^\]]+)\]\((.+)\)$/);
    return match ? { type: "link", label: match[1], target: match[2] } : { type: "text", text: token };
  }
  if (token.startsWith("**")) return { type: "strong", children: parseInline(token.slice(2, -2)) };
  if (token.startsWith("*")) return { type: "emphasis", children: parseInline(token.slice(1, -1)) };
  if (token.startsWith("`")) return { type: "code", text: token.slice(1, -1) };
  return { type: "text", text: token };
}

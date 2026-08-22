export function screen(children = [], diagnostics = []) {
  return { type: "screen", children, diagnostics };
}

export function diagnostic(message, line, severity = "error", code = "markup") {
  return { message, line, severity, code };
}

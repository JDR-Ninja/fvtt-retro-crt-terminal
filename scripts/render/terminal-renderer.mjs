export function renderTerminalBlocks(container, viewModel, { onNavigate, onLogin } = {}) {
  container.replaceChildren();
  const menuIndex = { value: 0 };
  for (const block of viewModel.blocks ?? []) container.append(renderBlock(block, { onNavigate, onLogin, menuIndex }));
  if (viewModel.diagnostics?.length && globalThis.game?.user?.isGM) container.append(renderDiagnostics(viewModel.diagnostics));
}

function renderBlock(block, handlers) {
  switch (block.type) {
    case "heading": return renderHeading(block, handlers);
    case "paragraph": return element("p", "terminal-paragraph", renderInline(block.children, handlers));
    case "list": return renderList(block, handlers);
    case "menu": return renderMenu(block, handlers);
    case "login": return renderLogin(block, handlers);
    case "image": return renderImage(block);
    case "effect": return element("div", `terminal-effect effect-${safeClass(block.effect)}`, renderInline(block.children, handlers));
    default: return element("p", "terminal-error", document.createTextNode(localize("RETRO_CRT_TERMINAL.Errors.FileUnavailable", "FILE UNAVAILABLE")));
  }
}

function renderHeading(block, handlers) {
  const heading = document.createElement(`h${Math.min(6, Math.max(1, block.level))}`);
  heading.className = "terminal-heading";
  heading.append(...renderInline(block.children, handlers));
  return heading;
}

function renderList(block, handlers) {
  const list = element("ul", "terminal-list");
  for (const item of block.items) list.append(element("li", "", renderInline(item.children, handlers)));
  return list;
}

function renderMenu(block, { onNavigate, menuIndex } = {}) {
  const menu = element("nav", "terminal-menu");
  menu.setAttribute("aria-label", localize("RETRO_CRT_TERMINAL.Navigation.Menu", "Terminal menu"));
  block.items.forEach(item => {
    const index = menuIndex?.value ?? 0;
    if (menuIndex) menuIndex.value += 1;
    const button = element("button", "terminal-menu-item");
    button.type = "button";
    button.dataset.menuIndex = String(index);
    button.dataset.target = item.pageUuid ?? item.target ?? "";
    if (!item.accessible) button.dataset.state = item.state;
    button.append(element("span", "terminal-menu-cursor", document.createTextNode(">")));
    button.append(element("span", "terminal-menu-label", document.createTextNode(item.label)));
    if (item.state === "locked") button.append(element("span", "terminal-menu-state", document.createTextNode(`[${localize("RETRO_CRT_TERMINAL.Status.Locked", "LOCKED")}]`)));
    else if (item.state === "missing") button.append(element("span", "terminal-menu-state", document.createTextNode(`[${localize("RETRO_CRT_TERMINAL.Status.Unavailable", "UNAVAILABLE")}]`)));
    else if (item.debug) button.append(element("span", "terminal-menu-state", document.createTextNode(`[${item.debug}]`)));
    button.addEventListener("click", () => onNavigate?.(item));
    menu.append(button);
  });
  return menu;
}

function renderLogin(block, { onLogin } = {}) {
  const form = element("form", "terminal-login");
  const id = `terminal-password-${crypto.randomUUID()}`;
  const label = element("label", "", document.createTextNode(block.prompt || localize("RETRO_CRT_TERMINAL.Lock.Prompt", "Authorization code")));
  label.htmlFor = id;
  const input = document.createElement("input");
  input.id = id;
  input.name = "password";
  input.type = "password";
  input.autocomplete = "off";
  const submit = element("button", "", document.createTextNode(localize("RETRO_CRT_TERMINAL.Actions.Submit", "Submit")));
  submit.type = "submit";
  form.append(label, input, submit);
  form.addEventListener("submit", event => {
    event.preventDefault();
    onLogin?.(input.value, block);
  });
  return form;
}

function renderImage(block) {
  const figure = element("figure", "terminal-image");
  if (!safeAssetPath(block.src)) return element("p", "terminal-error", document.createTextNode(localize("RETRO_CRT_TERMINAL.Errors.ImageUnavailable", "IMAGE UNAVAILABLE")));
  const image = document.createElement("img");
  image.src = block.src;
  image.alt = block.alt ?? "";
  image.loading = "lazy";
  figure.append(image);
  return figure;
}

function renderInline(nodes = [], handlers = {}) {
  return nodes.map(node => {
    if (node.type === "text") return document.createTextNode(node.text);
    if (node.type === "code") return element("code", "terminal-code", document.createTextNode(node.text));
    if (node.type === "strong" || node.type === "emphasis") {
      return element(node.type === "strong" ? "strong" : "em", "", renderInline(node.children, handlers));
    }
    if (node.type === "link") {
      const button = element("button", "terminal-inline-link", document.createTextNode(node.label || node.target));
      button.type = "button";
      button.addEventListener("click", () => handlers.onNavigate?.({ label: node.label, target: node.target, accessible: true }));
      return button;
    }
    return document.createTextNode("");
  });
}

function renderDiagnostics(diagnostics) {
  const details = element("details", "terminal-diagnostics");
  details.append(element("summary", "", document.createTextNode(localize("RETRO_CRT_TERMINAL.Diagnostics.Title", "Markup diagnostics"))));
  const list = document.createElement("ul");
  for (const item of diagnostics) list.append(element("li", `is-${safeClass(item.severity)}`, document.createTextNode(`L${item.line}: ${item.message}`)));
  details.append(list);
  return details;
}

function element(tag, className = "", children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  const normalized = Array.isArray(children) ? children : [children];
  node.append(...normalized.filter(Boolean));
  return node;
}

function safeClass(value) {
  return String(value ?? "none").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function safeAssetPath(value) {
  const path = String(value ?? "").trim();
  return Boolean(path) && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith("//");
}

function localize(key, fallback) {
  return globalThis.game?.i18n?.has?.(key) ? game.i18n.localize(key) : fallback;
}

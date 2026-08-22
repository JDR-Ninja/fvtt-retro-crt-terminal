const DEFAULT_SPEED = 18;

export function startTypewriter(container, { speed = DEFAULT_SPEED, delay = 0, onComplete } = {}) {
  const charactersPerSecond = Number(speed);
  const records = collectTextNodes(container);
  if (!container || !records.length || !Number.isFinite(charactersPerSecond) || charactersPerSecond <= 0) return null;

  let active = true;
  let timer = null;
  let recordIndex = 0;
  let characterIndex = 0;

  for (const record of records) record.node.data = "";
  container.classList.add("is-typing");
  container.setAttribute("aria-busy", "true");

  const finishFromPointer = event => {
    if (!active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    finish();
  };
  container.addEventListener("click", finishFromPointer, true);

  const cleanup = ({ reveal, completed }) => {
    if (!active) return;
    active = false;
    if (timer) clearTimeout(timer);
    if (reveal) for (const record of records) record.node.data = record.text;
    container.classList.remove("is-typing");
    container.removeAttribute("aria-busy");
    container.removeEventListener("click", finishFromPointer, true);
    if (completed) onComplete?.();
  };

  const finish = () => cleanup({ reveal: true, completed: true });
  const cancel = () => cleanup({ reveal: false, completed: false });

  const typeNextCharacter = () => {
    if (!active) return;
    while (recordIndex < records.length && characterIndex >= records[recordIndex].text.length) {
      recordIndex += 1;
      characterIndex = 0;
    }
    if (recordIndex >= records.length) return finish();

    const record = records[recordIndex];
    characterIndex += 1;
    const character = record.text[characterIndex - 1];
    record.node.data = record.text.slice(0, characterIndex);
    timer = setTimeout(typeNextCharacter, characterDelay(character, charactersPerSecond, characterIndex === record.text.length));
  };

  timer = setTimeout(typeNextCharacter, Math.max(0, Number(delay) || 0));
  return { get active() { return active; }, finish, cancel };
}

export function characterDelay(character, speed = DEFAULT_SPEED, endOfNode = false) {
  const base = Math.max(1, Number(speed) || DEFAULT_SPEED);
  if (/[.!?]/.test(character)) return base * 6;
  if (/[,;:]/.test(character)) return base * 3;
  if (character === "\n" || endOfNode) return base * 4;
  return base;
}

function collectTextNodes(container) {
  if (!container?.ownerDocument?.createTreeWalker) return [];
  const filter = container.ownerDocument.defaultView?.NodeFilter ?? globalThis.NodeFilter;
  if (!filter) return [];
  const walker = container.ownerDocument.createTreeWalker(container, filter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!node.data || !parent || parent.closest("script, style, input, textarea, select, [data-typewriter-skip]")) return filter.FILTER_REJECT;
      return filter.FILTER_ACCEPT;
    }
  });
  const records = [];
  let node;
  while ((node = walker.nextNode())) records.push({ node, text: node.data });
  return records;
}

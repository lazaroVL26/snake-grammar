type Attributes = Record<string, string | number | boolean | undefined>;

/** Cria um elemento com atributos e filhos em uma chamada. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function query<T extends Element>(selector: string, scope: ParentNode = document): T {
  const found = scope.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento nao encontrado: ${selector}`);
  return found;
}

export function clear(node: Element): void {
  node.replaceChildren();
}

export function setText(node: Element, value: string): void {
  node.textContent = value;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function focusableIn(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

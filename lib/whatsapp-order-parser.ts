import type { MenuCategory, MenuProduct } from '@/lib/types';

export type RecognizedWhatsAppItem = {
  id: string;
  product: MenuProduct;
  quantity: number;
  sourceText: string;
};

export type UnresolvedWhatsAppItem = {
  id: string;
  quantity: number;
  sourceText: string;
  candidates: MenuProduct[];
};

export type WhatsAppOrderParseResult = {
  recognized: RecognizedWhatsAppItem[];
  unresolved: UnresolvedWhatsAppItem[];
  notes: string[];
  ignored: string[];
};

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  tacos: ['taco', 'tacos', 'tazo', 'tazos', 'taquito', 'taquitos'],
  tortas: ['torta', 'tortas'],
  gringas: ['gringa', 'gringas'],
  tlayudas: ['tlayuda', 'tlayudas', 'clayuda', 'clayudas', 'ayuda', 'ayudas'],
  alambres: ['alambre', 'alambres'],
  tostadas: ['tostada', 'tostadas'],
  bebidas: [
    'bebida',
    'bebidas',
    'refresco',
    'refrescos',
    'coca',
    'cocas',
    'coca cola',
    'agua',
    'aguas',
    'malteada',
    'malteadas',
    'jarra',
    'vaso',
  ],
  kilos: ['kilo', 'kilos', 'kilogramo', 'kilogramos', 'kg', 'cuarto kilo', 'medio kilo'],
};

const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'por',
  'favor',
  'quiero',
  'quisiera',
  'dame',
  'me',
  'pones',
  'poner',
  'agrega',
  'agregame',
]);

export function normalizeOrderText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/coca[\s-]?cola/g, 'coca cola')
    .replace(/2\s*(?:litros?|lts?|l)\s*y\s*medio/g, '2.5 l')
    .replace(/dos\s*(?:litros?|lts?)\s*y\s*medio/g, '2.5 l')
    .replace(/medio\s+(?:kilo|kg)/g, '1/2 kg')
    .replace(/media\s+(?:kilo|kg)/g, '1/2 kg')
    .replace(/cuarto\s+(?:de\s+)?(?:kilo|kg)/g, '1/4 kg')
    .replace(/\b600\s*(?:mililitros?|ml)?\b/g, '600 ml')
    .replace(/[^a-z0-9./\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singular(value: string) {
  if (value.endsWith('es') && value.length > 5) return value.slice(0, -2);
  if (value.endsWith('s') && value.length > 3) return value.slice(0, -1);
  return value;
}

function containsPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

function editDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (a[row - 1] === b[column - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function tokensAreClose(left: string, right: string) {
  if (left === right || singular(left) === singular(right)) return true;
  const longest = Math.max(left.length, right.length);
  if (longest < 5) return false;
  return editDistance(left, right) <= (longest >= 9 ? 2 : 1);
}

function splitMessage(message: string) {
  return message
    .replace(/\r/g, '\n')
    .split(/[\n,;.!?]+/)
    .flatMap((part) => part.split(/\s+y\s+(?=(?:\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\b)/i))
    .map((part) => part.trim())
    .filter(Boolean);
}

function takeQuantity(text: string) {
  const normalized = normalizeOrderText(text).replace(
    /^(?:(?:hola|buenas|quiero|quisiera|dame|ponme|agregame|me das|me puede dar)\s+)+/,
    ''
  );
  const match = normalized.match(/^(?:(\d+)(?![\d/])|(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte))\b/);
  if (!match) return { quantity: 1, rest: normalized };
  const value = match[1] ?? match[2];
  const quantity = /^\d+$/.test(value) ? Number(value) : NUMBER_WORDS[value];
  return { quantity: Math.max(1, quantity), rest: normalized.slice(match[0].length).trim() };
}

function aliasesFor(category: MenuCategory) {
  const aliases = CATEGORY_ALIASES[category.id] ?? [];
  const normalizedName = normalizeOrderText(category.name);
  return Array.from(new Set([
    ...aliases,
    normalizedName,
    singular(normalizedName),
  ].filter(Boolean)));
}

function findCategory(text: string, categories: MenuCategory[]) {
  let best: { category: MenuCategory; length: number } | undefined;
  for (const category of categories) {
    for (const alias of aliasesFor(category)) {
      if (containsPhrase(text, alias) && (!best || alias.length > best.length)) {
        best = { category, length: alias.length };
      }
    }
  }
  return best?.category;
}

function productScore(text: string, product: MenuProduct) {
  const productText = normalizeOrderText(product.name);
  if (containsPhrase(text, productText)) return 100 + productText.length;

  const textTokens = text.split(' ').filter((token) => token && !STOP_WORDS.has(token));
  const productTokens = productText.split(' ').filter((token) => token && !STOP_WORDS.has(token));
  let score = 0;
  for (const productToken of productTokens) {
    if (['kg', 'ml', 'l'].includes(productToken)) continue;
    if (textTokens.some((token) => tokensAreClose(token, productToken))) score += productToken.length + 4;
    else if (productToken === '1' && /\bkilos?\b/.test(text)) score += 5;
  }

  const mentionsSize = /\b600\b|\b2\.5\b|\b1\/4\b|\b1\/2\b|\bkilos?\b/.test(text);
  if (productText.includes('600') && mentionsSize && !text.includes('600')) return 0;
  if (productText.includes('2.5') && mentionsSize && !text.includes('2.5')) return 0;
  if (productText.includes('1/4') && mentionsSize && !text.includes('1/4')) return 0;
  if (productText.includes('1/2') && mentionsSize && !text.includes('1/2')) return 0;
  if (productText.includes('1 kg') && mentionsSize && !containsPhrase(text, '1 kg') && !/\bkilos?\b/.test(text)) return 0;
  return score;
}

function bestProducts(text: string, candidates: MenuProduct[]) {
  const scored = candidates
    .map((product) => ({ product, score: productScore(text, product) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
  if (!scored[0]) return [];
  return scored.filter((item) => item.score === scored[0].score).map((item) => item.product);
}

function mergeRecognized(items: RecognizedWhatsAppItem[]) {
  const merged = new Map<string, RecognizedWhatsAppItem>();
  for (const item of items) {
    const current = merged.get(item.product.id);
    if (current) current.quantity += item.quantity;
    else merged.set(item.product.id, { ...item });
  }
  return Array.from(merged.values());
}

function isOrderNote(text: string) {
  return /\b(sin|aparte|extra|bien cocid|poco cocid|salsa|cebolla|cilantro|limon|servilleta|cubierto|referencia|porton|puerta)\b/.test(text);
}

export function parseWhatsAppOrder(
  message: string,
  categories: MenuCategory[],
  products: MenuProduct[]
): WhatsAppOrderParseResult {
  const activeCategories = categories.filter((category) => category.active);
  const activeProducts = products.filter((product) => product.active);
  const recognized: RecognizedWhatsAppItem[] = [];
  const unresolved: UnresolvedWhatsAppItem[] = [];
  const notes: string[] = [];
  const ignored: string[] = [];
  let previousCategory: MenuCategory | undefined;

  splitMessage(message).forEach((originalClause, index) => {
    let originalProductText = originalClause;
    const normalizedClause = normalizeOrderText(originalClause);
    if (/\b(quita|quitame|elimina|eliminame|borra|borrame|cambia|cambiame|ya no quiero|menos)\b/.test(normalizedClause)) {
      ignored.push(`Cambio solicitado: ${originalClause}`);
      return;
    }
    const noteMatch = originalClause.match(/\b(?:todo\s+)?(?:sin|aparte|extra|bien\s+cocid\w*|poco\s+cocid\w*|con\s+(?:salsa|cebolla|cilantro|lim[oó]n))\b/i);
    if (noteMatch?.index !== undefined) {
      notes.push(originalClause.slice(noteMatch.index).trim());
      originalProductText = originalClause.slice(0, noteMatch.index).trim();
    }

    const { quantity: baseQuantity, rest } = takeQuantity(originalProductText);
    let quantity = baseQuantity;
    let productText = rest;
    const isTacoOrder = /\borden(?:es)?(?:\s+de\s+5)?\b/.test(productText);
    if (isTacoOrder) {
      quantity *= 5;
      productText = productText.replace(/\borden(?:es)?(?:\s+de\s+5)?\b/g, 'tacos');
    }

    if (!productText) return;
    const explicitCategory = findCategory(productText, activeCategories);
    let category = explicitCategory;
    if (!category && previousCategory) {
      const previousProducts = activeProducts.filter((product) => product.categoryId === previousCategory?.id);
      if (/^de\b/.test(productText) || bestProducts(productText, previousProducts).length > 0) {
        category = previousCategory;
      }
    }
    if (explicitCategory) previousCategory = explicitCategory;
    const categoryProducts = category
      ? activeProducts.filter((product) => product.categoryId === category.id)
      : activeProducts;
    const matches = bestProducts(productText, categoryProducts);

    if (matches.length === 1) {
      recognized.push({
        id: `recognized-${index}`,
        product: matches[0],
        quantity,
        sourceText: originalClause,
      });
      return;
    }

    if (matches.length > 1) {
      unresolved.push({
        id: `unresolved-${index}`,
        quantity,
        sourceText: originalClause,
        candidates: matches,
      });
      return;
    }

    if (category && categoryProducts.length > 0) {
      unresolved.push({
        id: `unresolved-${index}`,
        quantity,
        sourceText: originalClause,
        candidates: categoryProducts,
      });
      return;
    }

    if (isOrderNote(normalizedClause)) notes.push(originalClause);
    else ignored.push(originalClause);
  });

  return {
    recognized: mergeRecognized(recognized),
    unresolved,
    notes: Array.from(new Set(notes.map((note) => note.trim()).filter(Boolean))),
    ignored,
  };
}

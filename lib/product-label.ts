import type { MenuCategory, MenuProduct } from '@/lib/types';

export function getProductLabel(product: MenuProduct, categories: MenuCategory[]) {
  const category = categories.find((item) => item.id === product.categoryId);
  const name = product.name.trim();
  if (!category) return name;

  if (category.id === 'tacos') return /^taco\b/i.test(name) ? name : `Taco de ${name}`;
  if (category.id === 'tortas') return /^torta\b/i.test(name) ? name : `Torta de ${name}`;
  if (category.id === 'gringas') return /^gringa\b/i.test(name) ? name : `Gringa de ${name}`;
  if (category.id === 'tlayudas') {
    if (/^tlayuda\b/i.test(name)) return name;
    return name.toLowerCase() === 'sencilla' ? 'Tlayuda sencilla' : `Tlayuda de ${name}`;
  }
  if (category.id === 'alambres') return /^alambre\b/i.test(name) ? name : `Alambre de ${name}`;
  if (category.id === 'tostadas') return /^tostada\b/i.test(name) ? name : `Tostada de ${name}`;
  return name;
}

export function getProductEmoji(product: MenuProduct, categories: MenuCategory[]) {
  return categories.find((item) => item.id === product.categoryId)?.emoji ?? '🍽️';
}


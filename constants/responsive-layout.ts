export function getScreenGutter(screenWidth: number) {
  return screenWidth < 380 ? 14 : 18;
}

export function getResponsiveColumnWidth(screenWidth: number, gap = 10) {
  const gutter = getScreenGutter(screenWidth);
  const contentWidth = Math.max(0, screenWidth - gutter * 2);
  const columns = screenWidth >= 300 ? 2 : 1;

  return Math.floor((contentWidth - gap * (columns - 1)) / columns);
}

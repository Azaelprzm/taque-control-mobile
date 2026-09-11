export const AppColors = {
  ink: '#201A17',
  muted: '#746A63',
  paper: '#FFF9F2',
  surface: '#FFFFFF',
  line: '#EADFD4',
  orange: '#E85D2A',
  orangeDark: '#B83D17',
  yellow: '#F7B32B',
  green: '#26734D',
  greenSoft: '#E5F3EB',
  blue: '#2C6E9F',
  red: '#B84236',
  redSoft: '#FCE9E6',
};

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);

export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalDateTime = () => {
  const date = new Date();
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return `${getLocalDateKey(date)}T${time}`;
};

export const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;


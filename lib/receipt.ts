import { formatMoney } from '@/constants/app-theme';
import type { Order } from '@/lib/types';
import * as Clipboard from 'expo-clipboard';
import { Linking, Share } from 'react-native';

export function buildReceiptMessage(order: Order) {
  const subtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal + order.deliveryFee;
  const lines = order.items.map((item) =>
    `${item.quantity} × ${item.productName} — ${formatMoney(item.unitPrice * item.quantity)}`
  );

  return [
    '🌮 *EL SAZÓN DE MI TIERRA*',
    '',
    ...lines,
    '',
    order.deliveryFee > 0 ? `Subtotal: ${formatMoney(subtotal)}` : null,
    order.deliveryFee > 0 ? `Envío: ${formatMoney(order.deliveryFee)}` : null,
    `*TOTAL: ${formatMoney(total)}*`,
    order.notes ? `Notas: ${order.notes}` : null,
    '',
    '¡Gracias por su compra!',
  ].filter((line): line is string => line !== null).join('\n');
}

export async function shareOrderReceipt(order: Order) {
  const message = buildReceiptMessage(order);
  const digits = order.phone.replace(/\D/g, '');

  if (digits.length >= 10) {
    const internationalNumber = digits.length === 10 ? `52${digits}` : digits;
    try {
      await Linking.openURL(`https://wa.me/${internationalNumber}?text=${encodeURIComponent(message)}`);
      return;
    } catch {
      // Fall back to the native share sheet if WhatsApp cannot be opened.
    }
  }

  await Share.share(
    { title: 'Cuenta de El Sazón de mi Tierra', message },
    { dialogTitle: 'Compartir cuenta' }
  );
}

export async function copyOrderReceipt(order: Order) {
  await Clipboard.setStringAsync(buildReceiptMessage(order));
}

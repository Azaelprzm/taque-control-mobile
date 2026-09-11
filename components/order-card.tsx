import { AppColors, formatMoney } from '@/constants/app-theme';
import type { Order } from '@/lib/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const serviceLabel: Record<Order['serviceType'], string> = {
  delivery: 'Domicilio',
  dine_in: 'En mesa',
  pickup: 'Para recoger',
};

export const getOrderTotal = (order: Order) =>
  order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + order.deliveryFee;

export function OrderCard({
  order,
  actionLabel,
  onAction,
  onEdit,
  onDelete,
  onShare,
  onCopy,
}: {
  order: Order;
  actionLabel?: string;
  onAction?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onCopy?: () => void;
}) {
  const identity = order.serviceType === 'dine_in'
    ? order.tableName || 'Mesa sin asignar'
    : order.customerName || serviceLabel[order.serviceType];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.numberBadge}>
          <Text style={styles.number}>#{String(order.number).padStart(3, '0')}</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{identity}</Text>
          <Text style={styles.meta}>{serviceLabel[order.serviceType]}</Text>
        </View>
        <Text style={styles.total}>{formatMoney(getOrderTotal(order))}</Text>
      </View>

      <View style={[styles.paymentBadge, order.paymentStatus === 'paid' ? styles.paymentPaid : styles.paymentPending]}>
        <MaterialIcons
          name={order.paymentStatus === 'paid' ? 'check-circle' : 'schedule'}
          size={16}
          color={order.paymentStatus === 'paid' ? AppColors.green : AppColors.orangeDark}
        />
        <Text style={[styles.paymentText, order.paymentStatus === 'paid' ? styles.paymentTextPaid : styles.paymentTextPending]}>
          {order.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente de pago'}
        </Text>
      </View>

      {order.paymentMethod === 'cash' && order.cashReceived > 0 ? (
        <Text style={styles.paymentDetail}>
          Paga con {formatMoney(order.cashReceived)} · Cambio {formatMoney(Math.max(0, order.cashReceived - getOrderTotal(order)))}
        </Text>
      ) : null}
      {order.paymentMethod === 'mixed' && order.cashAmount > 0 ? (
        <Text style={styles.paymentDetail}>
          Efectivo {formatMoney(order.cashAmount)} · Transferencia {formatMoney(order.transferAmount)}
        </Text>
      ) : null}

      <View style={styles.items}>
        {order.items.map((item) => (
          <Text key={item.id} style={styles.item}>
            <Text style={styles.quantity}>{item.quantity}× </Text>{item.productName}
          </Text>
        ))}
      </View>

      {order.notes ? (
        <View style={styles.noteRow}>
          <MaterialIcons name="sticky-note-2" size={16} color={AppColors.orange} />
          <Text style={styles.note}>{order.notes}</Text>
        </View>
      ) : null}

      {onShare || onCopy ? (
        <View style={styles.receiptActions}>
          {onCopy ? (
            <Pressable onPress={onCopy} style={styles.copyAction}>
              <MaterialIcons name="content-copy" size={17} color={AppColors.ink} />
              <Text style={styles.copyActionText}>Copiar ticket</Text>
            </Pressable>
          ) : null}
          {onShare ? (
            <Pressable onPress={onShare} style={styles.shareAction}>
              <MaterialIcons name="send" size={18} color={AppColors.green} />
              <Text style={styles.shareActionText}>Enviar por WhatsApp</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {order.paymentStatus === 'pending' ? (
        <View style={styles.actions}>
          {onDelete ? (
            <Pressable accessibilityLabel="Eliminar orden" onPress={onDelete} style={styles.deleteAction}>
              <MaterialIcons name="delete-outline" size={20} color={AppColors.red} />
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable onPress={onEdit} style={styles.editAction}>
              <MaterialIcons name="edit" size={17} color={AppColors.ink} />
              <Text style={styles.editActionText}>Editar</Text>
            </Pressable>
          ) : null}
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} style={styles.action}>
              <Text style={styles.actionText}>{actionLabel}</Text>
              <MaterialIcons name="check" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.line,
    gap: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberBadge: { backgroundColor: '#FFF0E8', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  number: { color: AppColors.orangeDark, fontWeight: '900', fontSize: 13 },
  titleWrap: { flex: 1 },
  title: { color: AppColors.ink, fontWeight: '900', fontSize: 16 },
  meta: { color: AppColors.muted, fontSize: 12, marginTop: 2 },
  total: { color: AppColors.ink, fontWeight: '900', fontSize: 17 },
  paymentBadge: { alignSelf: 'flex-start', minHeight: 30, paddingHorizontal: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  paymentPaid: { backgroundColor: AppColors.greenSoft },
  paymentPending: { backgroundColor: '#FFF0E8' },
  paymentText: { fontWeight: '900', fontSize: 12 },
  paymentTextPaid: { color: AppColors.green },
  paymentTextPending: { color: AppColors.orangeDark },
  paymentDetail: { color: AppColors.muted, fontSize: 12, fontWeight: '700', marginTop: -5 },
  items: { gap: 3, paddingLeft: 2 },
  item: { color: AppColors.ink, fontSize: 14, lineHeight: 20 },
  quantity: { color: AppColors.orange, fontWeight: '900' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FFF7E3', padding: 10, borderRadius: 10 },
  note: { flex: 1, color: AppColors.ink, fontSize: 13, lineHeight: 18 },
  receiptActions: { flexDirection: 'row', gap: 8 },
  copyAction: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: AppColors.line, backgroundColor: '#F2EAE4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  copyActionText: { color: AppColors.ink, fontWeight: '900', fontSize: 13 },
  shareAction: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#B9D8C7', backgroundColor: AppColors.greenSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareActionText: { color: AppColors.green, fontWeight: '900', fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.redSoft },
  editAction: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#F2EAE4' },
  editActionText: { color: AppColors.ink, fontWeight: '900', fontSize: 13 },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: AppColors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { color: '#FFFFFF', fontWeight: '900' },
});

import { AppScreen } from '@/components/app-screen';
import { OrderCard } from '@/components/order-card';
import { SegmentedControl } from '@/components/segmented-control';
import { SettleOrderModal } from '@/components/settle-order-modal';
import { AppColors, getLocalDateKey } from '@/constants/app-theme';
import { useAppData } from '@/lib/store';
import { copyOrderReceipt, shareOrderReceipt } from '@/lib/receipt';
import type { Order } from '@/lib/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

type Filter = 'all' | 'pending' | 'paid';

const filters: { label: string; value: Filter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Pagados', value: 'paid' },
];

export default function OrdersScreen() {
  const { loading, orders, settleOrder, deleteOrder } = useAppData();
  const [filter, setFilter] = useState<Filter>('all');
  const [settlementOrder, setSettlementOrder] = useState<Order | null>(null);
  const today = getLocalDateKey();

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (!order.createdAt.startsWith(today)) return false;
    if (order.status === 'cancelled') return false;
    if (filter === 'pending') return order.paymentStatus === 'pending';
    if (filter === 'paid') return order.paymentStatus === 'paid';
    return true;
  }), [filter, orders, today]);

  const confirmDelete = (id: string, number: number) => {
    Alert.alert(
      `Eliminar orden #${String(number).padStart(3, '0')}`,
      'Se eliminará la orden pendiente y dejará de aparecer en el corte del día.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteOrder(id) },
      ]
    );
  };

  return (
    <AppScreen
      title="Órdenes de hoy"
      subtitle={`${visibleOrders.length} ${visibleOrders.length === 1 ? 'orden visible' : 'órdenes visibles'}`}
      action={(
        <Pressable style={styles.addButton} onPress={() => router.navigate('./new-order')}>
          <MaterialIcons name="add" color="#FFFFFF" size={26} />
        </Pressable>
      )}>
      <SegmentedControl options={filters} value={filter} onChange={setFilter} />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={AppColors.orange} />
      ) : visibleOrders.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="receipt-long" size={34} color={AppColors.orange} />
          </View>
          <Text style={styles.emptyTitle}>Todo tranquilo por aquí</Text>
          <Text style={styles.emptyText}>Las órdenes que registres hoy aparecerán en esta pantalla.</Text>
          <Pressable style={styles.primary} onPress={() => router.navigate('./new-order')}>
            <Text style={styles.primaryText}>Crear la primera orden</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              actionLabel="Marcar pagada"
              onAction={() => setSettlementOrder(order)}
              onEdit={() => router.push({ pathname: './edit-order', params: { orderId: order.id } })}
              onDelete={() => confirmDelete(order.id, order.number)}
              onCopy={() => copyOrderReceipt(order).then(() => Alert.alert('Ticket copiado', 'Ya puedes pegarlo en cualquier mensaje.'))}
              onShare={order.serviceType === 'delivery' ? () => shareOrderReceipt(order) : undefined}
            />
          ))}
        </View>
      )}
      <SettleOrderModal
        order={settlementOrder}
        visible={Boolean(settlementOrder)}
        onClose={() => setSettlementOrder(null)}
        onConfirm={(details) => settlementOrder
          ? settleOrder(settlementOrder.id, details)
          : Promise.resolve()}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.orange,
  },
  loader: { marginTop: 60 },
  list: { gap: 12, marginTop: 18 },
  empty: { alignItems: 'center', paddingHorizontal: 26, paddingTop: 62 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E8',
    marginBottom: 18,
  },
  emptyTitle: { color: AppColors.ink, fontSize: 20, fontWeight: '900' },
  emptyText: { color: AppColors.muted, textAlign: 'center', lineHeight: 21, marginTop: 7 },
  primary: { backgroundColor: AppColors.ink, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, marginTop: 22 },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
});

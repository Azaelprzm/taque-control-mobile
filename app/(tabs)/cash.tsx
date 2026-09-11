import { AppScreen } from '@/components/app-screen';
import { getOrderTotal, OrderCard } from '@/components/order-card';
import { SegmentedControl } from '@/components/segmented-control';
import { SettleOrderModal } from '@/components/settle-order-modal';
import { AppColors, formatMoney, getLocalDateKey } from '@/constants/app-theme';
import { getResponsiveColumnWidth } from '@/constants/responsive-layout';
import { useAppData } from '@/lib/store';
import { copyOrderReceipt, shareOrderReceipt } from '@/lib/receipt';
import type { Order } from '@/lib/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'specific';

const periodOptions: { label: string; value: Period }[] = [
  { label: 'Hoy', value: 'today' },
  { label: 'Ayer', value: 'yesterday' },
  { label: '7 días', value: 'week' },
  { label: '30 días', value: 'month' },
  { label: 'Una fecha', value: 'specific' },
];

const serviceLabel: Record<Order['serviceType'], string> = {
  delivery: 'Domicilio',
  dine_in: 'En mesa',
  pickup: 'Para recoger',
};

function getDateKeyWithOffset(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return getLocalDateKey(date);
}

function formatDate(dateKey: string, long = false) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', long
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short' }
  ).format(new Date(year, month - 1, day));
}

export default function CashScreen() {
  const { width } = useWindowDimensions();
  const summaryCardWidth = getResponsiveColumnWidth(width);
  const { orders, settleOrder, deleteOrder } = useAppData();
  const [period, setPeriod] = useState<Period>('today');
  const [specificDate, setSpecificDate] = useState(getLocalDateKey());
  const [dateModal, setDateModal] = useState(false);
  const [settlementOrder, setSettlementOrder] = useState<Order | null>(null);
  const validOrders = useMemo(
    () => orders.filter((order) => order.status !== 'cancelled'),
    [orders]
  );

  const availableDates = useMemo(() => {
    const dates = [...new Set(validOrders.map((order) => order.createdAt.slice(0, 10)))];
    return dates.sort((a, b) => b.localeCompare(a));
  }, [validOrders]);

  const visibleOrders = useMemo(() => {
    const today = getLocalDateKey();
    const yesterday = getDateKeyWithOffset(-1);
    const weekStart = getDateKeyWithOffset(-6);
    const monthStart = getDateKeyWithOffset(-29);
    return validOrders.filter((order) => {
      const date = order.createdAt.slice(0, 10);
      if (period === 'today') return date === today;
      if (period === 'yesterday') return date === yesterday;
      if (period === 'week') return date >= weekStart && date <= today;
      if (period === 'month') return date >= monthStart && date <= today;
      return date === specificDate;
    });
  }, [period, specificDate, validOrders]);

  const summary = useMemo(() => {
    const total = visibleOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const cash = visibleOrders
      .filter((order) => order.paymentMethod === 'cash' && order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + getOrderTotal(order), 0);
    const transfer = visibleOrders
      .filter((order) => order.paymentMethod === 'transfer' && order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + getOrderTotal(order), 0);
    const mixed = visibleOrders
      .filter((order) => order.paymentMethod === 'mixed' && order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + getOrderTotal(order), 0);
    const pending = visibleOrders
      .filter((order) => order.paymentStatus === 'pending')
      .reduce((sum, order) => sum + getOrderTotal(order), 0);
    const deliveryFees = visibleOrders.reduce((sum, order) => sum + order.deliveryFee, 0);
    const itemCounts = new Map<string, number>();
    visibleOrders.forEach((order) => order.items.forEach((item) => {
      itemCounts.set(item.productName, (itemCounts.get(item.productName) ?? 0) + item.quantity);
    }));
    const topItems = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, cash, transfer, mixed, pending, deliveryFees, topItems };
  }, [visibleOrders]);

  const groupedOrders = useMemo(() => {
    const groups = new Map<string, Order[]>();
    visibleOrders.forEach((order) => {
      const date = order.createdAt.slice(0, 10);
      (groups.get(date) ?? groups.set(date, []).get(date))?.push(order);
    });
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visibleOrders]);

  const periodLabel = period === 'today'
    ? 'Hoy'
    : period === 'yesterday'
      ? 'Ayer'
      : period === 'week'
        ? 'Últimos 7 días'
        : period === 'month'
          ? 'Últimos 30 días'
          : formatDate(specificDate, true);

  const confirmDelete = (order: Order) => {
    Alert.alert(
      `Eliminar orden #${String(order.number).padStart(3, '0')}`,
      'Esta cuenta pendiente se eliminará definitivamente del historial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteOrder(order.id) },
      ]
    );
  };

  return (
    <AppScreen title="Caja e historial" subtitle="Consulta tus ventas por día o periodo">
      <Text style={styles.filterTitle}>Periodo</Text>
      <SegmentedControl options={periodOptions} value={period} onChange={setPeriod} />

      {period === 'specific' ? (
        <Pressable onPress={() => setDateModal(true)} style={styles.dateButton}>
          <MaterialIcons name="calendar-month" size={22} color={AppColors.orangeDark} />
          <View style={styles.dateButtonCopy}>
            <Text style={styles.dateButtonLabel}>Fecha seleccionada</Text>
            <Text style={styles.dateButtonValue}>{formatDate(specificDate, true)}</Text>
          </View>
          <MaterialIcons name="expand-more" size={22} color={AppColors.muted} />
        </Pressable>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>VENTA TOTAL · {periodLabel.toUpperCase()}</Text>
        <Text style={styles.heroValue}>{formatMoney(summary.total)}</Text>
        <Text style={styles.heroMeta}>
          {visibleOrders.length} órdenes · Ticket promedio {formatMoney(visibleOrders.length ? summary.total / visibleOrders.length : 0)}
        </Text>
      </View>

      <View style={styles.grid}>
        <SummaryCard width={summaryCardWidth} icon="payments" label="Efectivo pagado" value={summary.cash} color={AppColors.green} />
        <SummaryCard width={summaryCardWidth} icon="account-balance" label="Transferencias" value={summary.transfer} color={AppColors.blue} />
        <SummaryCard width={summaryCardWidth} icon="schedule" label="Por cobrar" value={summary.pending} color={AppColors.orange} />
        <SummaryCard width={summaryCardWidth} icon="call-split" label="Pagos mixtos" value={summary.mixed} color={AppColors.ink} />
      </View>

      <View style={styles.deliveryLine}>
        <MaterialIcons name="delivery-dining" size={20} color={AppColors.orangeDark} />
        <Text style={styles.deliveryLabel}>Cobrado por envíos</Text>
        <Text style={styles.deliveryValue}>{formatMoney(summary.deliveryFees)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Más vendidos del periodo</Text>
        {summary.topItems.length === 0 ? (
          <Text style={styles.empty}>No hay ventas registradas en este periodo.</Text>
        ) : summary.topItems.map(([name, count], index) => (
          <View key={name} style={styles.rankingRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.itemName}>{name}</Text>
            <Text style={styles.itemCount}>{count} pzas.</Text>
          </View>
        ))}
      </View>

      <View style={styles.historyHeader}>
        <View>
          <Text style={styles.historyTitle}>Historial de ventas</Text>
          <Text style={styles.historySubtitle}>{periodLabel}</Text>
        </View>
        <View style={styles.orderCountBadge}>
          <Text style={styles.orderCountText}>{visibleOrders.length}</Text>
        </View>
      </View>

      {groupedOrders.length === 0 ? (
        <View style={styles.historyEmpty}>
          <MaterialIcons name="event-busy" size={34} color={AppColors.orange} />
          <Text style={styles.historyEmptyTitle}>No hay órdenes en esta fecha</Text>
          <Text style={styles.historyEmptyText}>Prueba con otro día o selecciona un periodo más amplio.</Text>
        </View>
      ) : groupedOrders.map(([date, dayOrders]) => (
        <View key={date} style={styles.dayGroup}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{formatDate(date, true)}</Text>
            <Text style={styles.dayTotal}>
              {formatMoney(dayOrders.reduce((sum, order) => sum + getOrderTotal(order), 0))}
            </Text>
          </View>
          <View style={styles.orderList}>
            {dayOrders.map((order) => (
              <View key={order.id}>
                <View style={styles.orderContext}>
                  <MaterialIcons name="schedule" size={15} color={AppColors.muted} />
                  <Text style={styles.orderContextText}>
                    {order.createdAt.slice(11, 16)} · {serviceLabel[order.serviceType]}
                  </Text>
                </View>
                <OrderCard
                  order={order}
                  actionLabel="Marcar pagada"
                  onAction={() => setSettlementOrder(order)}
                  onEdit={() => router.push({ pathname: './edit-order', params: { orderId: order.id } })}
                  onDelete={() => confirmDelete(order)}
                  onCopy={() => copyOrderReceipt(order).then(() => Alert.alert('Ticket copiado', 'Ya puedes pegarlo en cualquier mensaje.'))}
                  onShare={order.serviceType === 'delivery' ? () => shareOrderReceipt(order) : undefined}
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      <SettleOrderModal
        order={settlementOrder}
        visible={Boolean(settlementOrder)}
        onClose={() => setSettlementOrder(null)}
        onConfirm={(details) => settlementOrder
          ? settleOrder(settlementOrder.id, details)
          : Promise.resolve()}
      />

      <Modal visible={dateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDateModal(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Seleccionar fecha</Text>
              <Text style={styles.modalSubtitle}>Se muestran los días que tienen órdenes</Text>
            </View>
            <Pressable onPress={() => setDateModal(false)} style={styles.closeButton}>
              <MaterialIcons name="close" size={22} color={AppColors.ink} />
            </Pressable>
          </View>
          <FlatList
            data={availableDates}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.dateList}
            ListEmptyComponent={<Text style={styles.empty}>Todavía no hay fechas con ventas.</Text>}
            renderItem={({ item }) => {
              const dayOrders = validOrders.filter((order) => order.createdAt.startsWith(item));
              const selected = item === specificDate;
              return (
                <Pressable
                  onPress={() => {
                    setSpecificDate(item);
                    setDateModal(false);
                  }}
                  style={[styles.dateRow, selected && styles.dateRowSelected]}>
                  <View style={styles.calendarIcon}>
                    <MaterialIcons name="calendar-today" size={19} color={selected ? '#FFFFFF' : AppColors.orangeDark} />
                  </View>
                  <View style={styles.dateRowCopy}>
                    <Text style={[styles.dateRowTitle, selected && styles.dateRowTitleSelected]}>{formatDate(item, true)}</Text>
                    <Text style={[styles.dateRowMeta, selected && styles.dateRowMetaSelected]}>{dayOrders.length} órdenes</Text>
                  </View>
                  <Text style={[styles.dateRowTotal, selected && styles.dateRowTitleSelected]}>
                    {formatMoney(dayOrders.reduce((sum, order) => sum + getOrderTotal(order), 0))}
                  </Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </AppScreen>
  );
}

function SummaryCard({ icon, label, value, color, width }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: number;
  color: string;
  width: number;
}) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={[styles.icon, { backgroundColor: `${color}16` }]}>
        <MaterialIcons name={icon} size={21} color={color} />
      </View>
      <Text style={styles.cardValue}>{formatMoney(value)}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterTitle: { color: AppColors.ink, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  dateButton: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, marginTop: 11, borderRadius: 15, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface },
  dateButtonCopy: { flex: 1 },
  dateButtonLabel: { color: AppColors.muted, fontSize: 11, fontWeight: '700' },
  dateButtonValue: { color: AppColors.ink, fontSize: 14, fontWeight: '900', textTransform: 'capitalize', marginTop: 2 },
  hero: { backgroundColor: AppColors.ink, borderRadius: 22, padding: 22, marginTop: 14, marginBottom: 14 },
  heroLabel: { color: AppColors.yellow, fontWeight: '900', letterSpacing: 1.2, fontSize: 10 },
  heroValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', marginTop: 5 },
  heroMeta: { color: '#D8CEC6', marginTop: 6, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.line, borderRadius: 17, padding: 15 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardValue: { color: AppColors.ink, fontSize: 19, fontWeight: '900', marginTop: 13 },
  cardLabel: { color: AppColors.muted, fontSize: 12, marginTop: 3 },
  deliveryLine: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10, paddingHorizontal: 14, backgroundColor: '#FFF0E8', borderRadius: 14 },
  deliveryLabel: { flex: 1, color: AppColors.muted, fontWeight: '700' },
  deliveryValue: { color: AppColors.orangeDark, fontWeight: '900' },
  section: { backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.line, borderRadius: 18, padding: 17, marginTop: 14 },
  sectionTitle: { color: AppColors.ink, fontSize: 17, fontWeight: '900', marginBottom: 8 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderTopWidth: 1, borderTopColor: '#F2EAE3' },
  rank: { width: 28, color: AppColors.orange, fontWeight: '900' },
  itemName: { flex: 1, color: AppColors.ink, fontWeight: '700' },
  itemCount: { color: AppColors.muted, fontSize: 12 },
  empty: { color: AppColors.muted, paddingVertical: 14, textAlign: 'center' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  historyTitle: { color: AppColors.ink, fontSize: 21, fontWeight: '900' },
  historySubtitle: { color: AppColors.muted, fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  orderCountBadge: { minWidth: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0E8' },
  orderCountText: { color: AppColors.orangeDark, fontWeight: '900' },
  historyEmpty: { alignItems: 'center', padding: 28, borderRadius: 18, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface },
  historyEmptyTitle: { color: AppColors.ink, fontWeight: '900', fontSize: 17, marginTop: 12 },
  historyEmptyText: { color: AppColors.muted, textAlign: 'center', lineHeight: 19, marginTop: 5 },
  dayGroup: { marginBottom: 20 },
  dayHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 9, paddingHorizontal: 2 },
  dayTitle: { flex: 1, color: AppColors.ink, fontWeight: '900', fontSize: 14, textTransform: 'capitalize' },
  dayTotal: { color: AppColors.orangeDark, fontWeight: '900' },
  orderList: { gap: 12 },
  orderContext: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5, marginLeft: 3 },
  orderContextText: { color: AppColors.muted, fontSize: 11, fontWeight: '700' },
  modalSafe: { flex: 1, backgroundColor: AppColors.paper },
  modalHeader: { minHeight: 82, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: AppColors.line },
  modalTitle: { color: AppColors.ink, fontSize: 22, fontWeight: '900' },
  modalSubtitle: { color: AppColors.muted, fontSize: 12, marginTop: 3 },
  closeButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE7E0' },
  dateList: { padding: 16, gap: 9 },
  dateRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface },
  dateRowSelected: { backgroundColor: AppColors.ink, borderColor: AppColors.ink },
  calendarIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0E8' },
  dateRowCopy: { flex: 1 },
  dateRowTitle: { color: AppColors.ink, fontWeight: '900', fontSize: 13, textTransform: 'capitalize' },
  dateRowTitleSelected: { color: '#FFFFFF' },
  dateRowMeta: { color: AppColors.muted, fontSize: 11, marginTop: 3 },
  dateRowMetaSelected: { color: '#CFC4BB' },
  dateRowTotal: { color: AppColors.orangeDark, fontWeight: '900' },
});

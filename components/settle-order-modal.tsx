import { getOrderTotal } from '@/components/order-card';
import { AppColors, formatMoney } from '@/constants/app-theme';
import type { Order } from '@/lib/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PaymentDetails = Pick<Order, 'cashReceived' | 'cashAmount' | 'transferAmount'>;

export function SettleOrderModal({
  order,
  visible,
  onClose,
  onConfirm,
}: {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (details: PaymentDetails) => Promise<void>;
}) {
  const [cashReceived, setCashReceived] = useState('');
  const [cashPart, setCashPart] = useState('');
  const [saving, setSaving] = useState(false);
  const total = order ? getOrderTotal(order) : 0;
  const received = Number(cashReceived) || 0;
  const cash = Number(cashPart) || 0;
  const transfer = Math.max(0, total - cash);

  useEffect(() => {
    if (!visible || !order) return;
    setCashReceived(order.cashReceived > 0 ? String(order.cashReceived) : '');
    setCashPart(order.cashAmount > 0 && order.paymentMethod === 'mixed' ? String(order.cashAmount) : '');
  }, [order, visible]);

  const validation = useMemo(() => {
    if (!order) return { valid: false, message: '' };
    if (order.paymentMethod === 'cash' && received < total) {
      return { valid: false, message: `Faltan ${formatMoney(total - received)} para cubrir la cuenta.` };
    }
    if (order.paymentMethod === 'mixed' && (cash <= 0 || cash >= total)) {
      return { valid: false, message: 'El efectivo debe ser mayor a $0 y menor al total.' };
    }
    return { valid: true, message: '' };
  }, [cash, order, received, total]);

  const submit = async () => {
    if (!order || !validation.valid) return;
    setSaving(true);
    try {
      await onConfirm(order.paymentMethod === 'cash'
        ? { cashReceived: received, cashAmount: total, transferAmount: 0 }
        : order.paymentMethod === 'mixed'
          ? { cashReceived: cash, cashAmount: cash, transferAmount: transfer }
          : { cashReceived: 0, cashAmount: 0, transferAmount: total });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>LIQUIDAR CUENTA</Text>
              <Text style={styles.title}>Orden #{String(order.number).padStart(3, '0')}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close}>
              <MaterialIcons name="close" size={22} color={AppColors.ink} />
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total a cobrar</Text>
              <Text style={styles.totalValue}>{formatMoney(total)}</Text>
            </View>

            {order.paymentMethod === 'cash' ? (
              <>
                <Text style={styles.label}>El cliente paga con</Text>
                <MoneyInput value={cashReceived} onChangeText={setCashReceived} placeholder={String(total)} />
                <View style={styles.resultCard}>
                  <Text style={styles.resultLabel}>Cambio</Text>
                  <Text style={styles.changeValue}>{formatMoney(Math.max(0, received - total))}</Text>
                </View>
              </>
            ) : null}

            {order.paymentMethod === 'mixed' ? (
              <>
                <Text style={styles.label}>Parte recibida en efectivo</Text>
                <MoneyInput value={cashPart} onChangeText={setCashPart} placeholder="0" />
                <View style={styles.mixedCard}>
                  <View>
                    <Text style={styles.resultLabel}>Efectivo</Text>
                    <Text style={styles.mixedValue}>{formatMoney(cash)}</Text>
                  </View>
                  <MaterialIcons name="add" size={20} color={AppColors.muted} />
                  <View style={styles.mixedRight}>
                    <Text style={styles.resultLabel}>Transferencia</Text>
                    <Text style={styles.mixedValue}>{formatMoney(transfer)}</Text>
                  </View>
                </View>
              </>
            ) : null}

            {order.paymentMethod === 'transfer' ? (
              <View style={styles.transferInfo}>
                <MaterialIcons name="account-balance" size={24} color={AppColors.blue} />
                <Text style={styles.transferText}>Confirma que recibiste la transferencia completa antes de registrar el pago.</Text>
              </View>
            ) : null}

            {validation.message ? <Text style={styles.error}>{validation.message}</Text> : null}

            <Pressable
              disabled={!validation.valid || saving}
              onPress={submit}
              style={[styles.confirm, (!validation.valid || saving) && styles.confirmDisabled]}>
              <MaterialIcons name="check-circle" size={21} color="#FFFFFF" />
              <Text style={styles.confirmText}>{saving ? 'Guardando…' : 'Confirmar pago'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function MoneyInput({ value, onChangeText, placeholder }: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.currency}>$</Text>
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#A4978E"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.paper },
  fill: { flex: 1 },
  header: { minHeight: 86, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: AppColors.line },
  eyebrow: { color: AppColors.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: AppColors.ink, fontSize: 25, fontWeight: '900', marginTop: 3 },
  close: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE7E0' },
  content: { flex: 1, padding: 20 },
  totalCard: { backgroundColor: AppColors.ink, borderRadius: 19, padding: 20 },
  totalLabel: { color: '#D8CEC6', fontWeight: '700' },
  totalValue: { color: AppColors.yellow, fontSize: 36, fontWeight: '900', marginTop: 4 },
  label: { color: AppColors.ink, fontSize: 14, fontWeight: '900', marginTop: 24, marginBottom: 8 },
  inputWrap: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 2, borderColor: AppColors.orange, backgroundColor: AppColors.surface },
  currency: { color: AppColors.orangeDark, fontSize: 20, fontWeight: '900', paddingLeft: 16 },
  input: { flex: 1, minHeight: 56, paddingHorizontal: 9, color: AppColors.ink, fontSize: 23, fontWeight: '900' },
  resultCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, marginTop: 12, borderRadius: 15, backgroundColor: AppColors.greenSoft },
  resultLabel: { color: AppColors.muted, fontSize: 12, fontWeight: '700' },
  changeValue: { color: AppColors.green, fontSize: 25, fontWeight: '900' },
  mixedCard: { minHeight: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, marginTop: 12, borderRadius: 15, backgroundColor: '#EAF4FA' },
  mixedRight: { alignItems: 'flex-end' },
  mixedValue: { color: AppColors.ink, fontSize: 20, fontWeight: '900', marginTop: 4 },
  transferInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17, marginTop: 22, borderRadius: 15, backgroundColor: '#EAF4FA' },
  transferText: { flex: 1, color: '#31566C', lineHeight: 19 },
  error: { color: AppColors.red, fontWeight: '700', fontSize: 12, marginTop: 12 },
  confirm: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20, borderRadius: 16, backgroundColor: AppColors.green },
  confirmDisabled: { opacity: 0.45 },
  confirmText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});


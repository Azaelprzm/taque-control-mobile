import { AppScreen } from '@/components/app-screen';
import { SegmentedControl } from '@/components/segmented-control';
import { WhatsAppOrderImportModal } from '@/components/whatsapp-order-import-modal';
import { AppColors, formatMoney } from '@/constants/app-theme';
import { getResponsiveColumnWidth } from '@/constants/responsive-layout';
import { useAppData } from '@/lib/store';
import { getProductEmoji, getProductLabel } from '@/lib/product-label';
import { copyOrderReceipt, shareOrderReceipt } from '@/lib/receipt';
import type {
  CartItem,
  MenuProduct,
  OrderSource,
  PaymentMethod,
  PaymentStatus,
  ServiceType,
} from '@/lib/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

const serviceOptions: { label: string; value: ServiceType }[] = [
  { label: 'A domicilio', value: 'delivery' },
  { label: 'En mesa', value: 'dine_in' },
  { label: 'Para recoger', value: 'pickup' },
];
const sourceOptions: { label: string; value: OrderSource }[] = [
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Llamada', value: 'phone' },
  { label: 'En persona', value: 'counter' },
];
const paymentOptions: { label: string; value: PaymentMethod }[] = [
  { label: 'Efectivo', value: 'cash' },
  { label: 'Transferencia', value: 'transfer' },
  { label: 'Mixto', value: 'mixed' },
];
const paymentStatusOptions: { label: string; value: PaymentStatus }[] = [
  { label: 'Pagado', value: 'paid' },
  { label: 'Pendiente', value: 'pending' },
];

export function OrderFormScreen({ orderId }: { orderId?: string }) {
  const { width } = useWindowDimensions();
  const productCardWidth = getResponsiveColumnWidth(width);
  const { categories, products, orders, createOrder, updateOrder } = useAppData();
  const editingOrder = orderId ? orders.find((order) => order.id === orderId) : undefined;
  const [categoryId, setCategoryId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType>('delivery');
  const [source, setSource] = useState<OrderSource>('whatsapp');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tableName, setTableName] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [cashReceived, setCashReceived] = useState('');
  const [cashPart, setCashPart] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedOrderId, setLoadedOrderId] = useState('');
  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const activeCategories = categories.filter((category) => category.active);
  useEffect(() => {
    if (!categoryId && activeCategories[0]) setCategoryId(activeCategories[0].id);
  }, [activeCategories, categoryId]);

  useEffect(() => {
    if (!editingOrder || loadedOrderId === editingOrder.id) return;
    setCart(editingOrder.items.flatMap((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return product ? [{ product: { ...product, price: item.unitPrice }, quantity: item.quantity }] : [];
    }));
    setServiceType(editingOrder.serviceType);
    setSource(editingOrder.source);
    setPaymentMethod(editingOrder.paymentMethod);
    setPaymentStatus(editingOrder.paymentStatus);
    setCustomerName(editingOrder.customerName);
    setPhone(editingOrder.phone);
    setAddress(editingOrder.address);
    setTableName(editingOrder.tableName);
    setNotes(editingOrder.notes);
    setDeliveryFee(String(editingOrder.deliveryFee));
    setCashReceived(editingOrder.cashReceived > 0 ? String(editingOrder.cashReceived) : '');
    setCashPart(editingOrder.cashAmount > 0 && editingOrder.paymentMethod === 'mixed' ? String(editingOrder.cashAmount) : '');
    setLoadedOrderId(editingOrder.id);
  }, [editingOrder, loadedOrderId, products]);

  useEffect(() => {
    if (serviceType === 'dine_in' && source !== 'counter') setSource('counter');
    if (serviceType === 'delivery' && source === 'counter') setSource('whatsapp');
  }, [serviceType, source]);

  useEffect(() => {
    setCart((current) => current.filter((item) =>
      products.some((product) => product.id === item.product.id)
    ));
  }, [products]);

  const visibleProducts = products.filter((product) => product.categoryId === categoryId && product.active);
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );
  const fee = serviceType === 'delivery' ? Number(deliveryFee) || 0 : 0;
  const total = subtotal + fee;
  const receivedAmount = Number(cashReceived) || 0;
  const cashPartAmount = Number(cashPart) || 0;
  const mixedTransferAmount = Math.max(0, total - cashPartAmount);

  const addProduct = (product: MenuProduct, amount = 1) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (!existing) return [...current, { product, quantity: amount }];
      return current.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + amount }
          : item
      );
    });
  };

  const changeQuantity = (productId: string, amount: number) => {
    setCart((current) => current
      .map((item) => item.product.id === productId
        ? { ...item, quantity: item.quantity + amount }
        : item)
      .filter((item) => item.quantity > 0));
  };

  const removeItem = (productId: string) => {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  };

  const openWhatsAppImporter = async () => {
    try {
      const hasText = await Clipboard.hasStringAsync();
      const clipboardText = hasText ? (await Clipboard.getStringAsync()).trim() : '';
      if (!clipboardText) {
        Alert.alert(
          'No hay un mensaje copiado',
          'Ve a WhatsApp, mantén presionado el mensaje del cliente, toca Copiar y vuelve a intentarlo.'
        );
        return;
      }
      setImportText(clipboardText);
      setImportVisible(true);
    } catch {
      Alert.alert('No pude leer el portapapeles', 'También puedes seguir capturando la orden manualmente.');
    }
  };

  const applyWhatsAppImport = (items: CartItem[], detectedNotes: string[]) => {
    setCart((current) => {
      const next = current.map((item) => ({ ...item }));
      for (const importedItem of items) {
        const existing = next.find((item) => item.product.id === importedItem.product.id);
        if (existing) existing.quantity += importedItem.quantity;
        else next.push(importedItem);
      }
      return next;
    });
    if (detectedNotes.length > 0) {
      setNotes((current) => Array.from(new Set([
        ...current.split('\n').map((note) => note.trim()).filter(Boolean),
        ...detectedNotes,
      ])).join('\n'));
    }
    if (serviceType !== 'dine_in') setSource('whatsapp');
    setImportVisible(false);
  };

  const reset = () => {
    setCart([]);
    setServiceType('delivery');
    setSource('whatsapp');
    setPaymentMethod('cash');
    setPaymentStatus('pending');
    setCustomerName('');
    setPhone('');
    setAddress('');
    setTableName('');
    setNotes('');
    setDeliveryFee('0');
    setCashReceived('');
    setCashPart('');
  };

  const submit = async () => {
    if (cart.length === 0) {
      Alert.alert('Faltan productos', 'Agrega al menos un producto para guardar el pedido.');
      return;
    }
    if (serviceType === 'delivery' && !customerName.trim()) {
      Alert.alert('Falta el cliente', 'Escribe el nombre del cliente para identificar el domicilio.');
      return;
    }
    if (serviceType === 'dine_in' && !tableName.trim()) {
      Alert.alert('Falta la mesa', 'Escribe el número o nombre de la mesa.');
      return;
    }
    if (paymentStatus === 'paid' && paymentMethod === 'cash' && receivedAmount < total) {
      Alert.alert('Revisa el efectivo', `El monto recibido debe cubrir el total de ${formatMoney(total)}.`);
      return;
    }
    if (paymentStatus === 'paid' && paymentMethod === 'mixed' && (cashPartAmount <= 0 || cashPartAmount >= total)) {
      Alert.alert('Revisa el pago mixto', 'La parte en efectivo debe ser mayor a $0 y menor al total de la cuenta.');
      return;
    }

    try {
      setSaving(true);
      const input = {
        serviceType,
        source,
        paymentMethod,
        paymentStatus,
        cashReceived: paymentMethod === 'cash' ? receivedAmount : paymentMethod === 'mixed' ? cashPartAmount : 0,
        cashAmount: paymentMethod === 'cash' ? total : paymentMethod === 'mixed' ? cashPartAmount : 0,
        transferAmount: paymentMethod === 'transfer' ? total : paymentMethod === 'mixed' ? mixedTransferAmount : 0,
        customerName,
        phone,
        address,
        tableName,
        notes,
        deliveryFee: fee,
        items: cart,
      };
      if (editingOrder) {
        await updateOrder(editingOrder.id, input);
        Alert.alert(
          paymentStatus === 'paid' ? 'Venta registrada' : 'Orden actualizada',
          `Se guardaron los cambios de la orden #${String(editingOrder.number).padStart(3, '0')}.`
        );
        router.back();
      } else {
        const createdOrder = await createOrder(input);
        reset();
        router.navigate('/');
        const title = paymentStatus === 'paid' ? 'Venta registrada' : 'Cuenta pendiente guardada';
        const message = `La orden #${String(createdOrder.number).padStart(3, '0')} quedó registrada.`;
        if (createdOrder.serviceType === 'delivery') {
          Alert.alert(title, message, [
            { text: 'WhatsApp', onPress: () => shareOrderReceipt(createdOrder) },
            {
              text: 'Copiar ticket',
              onPress: () => copyOrderReceipt(createdOrder)
                .then(() => Alert.alert('Ticket copiado', 'Ya puedes pegarlo en cualquier mensaje.')),
            },
            { text: 'Listo', style: 'cancel' },
          ]);
        } else {
          Alert.alert(title, message, [
            {
              text: 'Copiar ticket',
              onPress: () => copyOrderReceipt(createdOrder)
                .then(() => Alert.alert('Ticket copiado', 'Ya puedes pegarlo en cualquier mensaje.')),
            },
            { text: 'Listo', style: 'cancel' },
          ]);
        }
      }
    } catch {
      Alert.alert('No se pudo guardar', 'Intenta nuevamente. La información del formulario sigue aquí.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen
      includeBottomInset={Boolean(orderId)}
      scrollRef={scrollRef}
      title={editingOrder ? `Editar orden #${String(editingOrder.number).padStart(3, '0')}` : 'Nueva orden'}
      subtitle={editingOrder ? 'Puedes cambiar productos, cantidades y datos de la cuenta' : 'Toca un producto para agregarlo'}>
      <SectionTitle title="1. Tipo de servicio" />
      <SegmentedControl options={serviceOptions} value={serviceType} onChange={setServiceType} />

      <View style={styles.whatsAppImportCard}>
        <View style={styles.whatsAppImportIcon}>
          <MaterialIcons name="chat" size={22} color={AppColors.green} />
        </View>
        <View style={styles.whatsAppImportCopy}>
          <Text style={styles.whatsAppImportTitle}>¿Te escribieron por WhatsApp?</Text>
          <Text style={styles.whatsAppImportText}>Copia el mensaje y conviértelo en un borrador de pedido.</Text>
        </View>
        <Pressable onPress={openWhatsAppImporter} style={styles.whatsAppImportButton}>
          <MaterialIcons name="content-paste" size={17} color="#FFFFFF" />
          <Text style={styles.whatsAppImportButtonText}>Pegar</Text>
        </Pressable>
      </View>

      <View style={styles.sectionGap} />
      <SectionTitle title="2. Elige los productos" />
      <View style={styles.categoryRow}>
        {activeCategories.map((category) => {
          const selected = category.id === categoryId;
          return (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[styles.category, selected && styles.categorySelected]}>
              <Text style={styles.categoryEmoji}>{category.emoji}</Text>
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.productGrid}>
        {visibleProducts.map((product) => {
          const inCart = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
          const isTaco = categoryId === 'tacos';
          return (
            <View
              key={product.id}
              style={[styles.productCard, { width: productCardWidth }, inCart > 0 && styles.productSelected]}>
              <Pressable onPress={() => addProduct(product)} style={styles.productMain}>
                <Text style={styles.productName}>{product.name}</Text>
                {product.detail ? <Text style={styles.productDetail}>{product.detail}</Text> : null}
                <Text style={styles.productPrice}>{formatMoney(product.price)}</Text>
              </Pressable>
              {isTaco ? (
                <Pressable onPress={() => addProduct(product, 5)} style={styles.orderFive}>
                  <Text style={styles.orderFiveText}>+ orden de 5</Text>
                </Pressable>
              ) : null}
              {inCart > 0 ? <Text style={styles.inCart}>{inCart} en pedido</Text> : null}
            </View>
          );
        })}
      </View>

      {cart.length > 0 ? (
        <View style={styles.cart}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Tu pedido</Text>
            <Text style={styles.cartTotal}>{formatMoney(subtotal)}</Text>
          </View>
          {cart.map((item) => (
            <View key={item.product.id} style={styles.cartRow}>
              <View style={styles.cartCopy}>
                <Text style={styles.cartName} numberOfLines={2}>
                  {getProductEmoji(item.product, categories)} {getProductLabel(item.product, categories)}
                </Text>
                <Text style={styles.cartPrice}>{formatMoney(item.product.price)} c/u</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable style={styles.stepButton} onPress={() => changeQuantity(item.product.id, -1)}>
                  <MaterialIcons name="remove" size={18} color={AppColors.ink} />
                </Pressable>
                <Text style={styles.stepValue}>{item.quantity}</Text>
                <Pressable style={styles.stepButton} onPress={() => changeQuantity(item.product.id, 1)}>
                  <MaterialIcons name="add" size={18} color={AppColors.ink} />
                </Pressable>
                <Pressable
                  accessibilityLabel={`Quitar ${item.product.name}`}
                  style={styles.removeItemButton}
                  onPress={() => removeItem(item.product.id)}>
                  <MaterialIcons name="delete-outline" size={18} color="#F6B5AC" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.sectionGap} />
      <SectionTitle title="3. Datos del pedido" />
      <Field label={serviceType === 'dine_in' ? 'Nombre (opcional)' : 'Nombre del cliente'} value={customerName} onChangeText={setCustomerName} placeholder="Ej. María López" />
      {serviceType === 'dine_in' ? (
        <Field label="Mesa" value={tableName} onChangeText={setTableName} placeholder="Ej. Mesa 2" />
      ) : (
        <Field label="Teléfono" value={phone} onChangeText={setPhone} placeholder="Número de contacto" keyboardType="phone-pad" />
      )}
      {serviceType === 'delivery' ? (
        <>
          <Field label="Dirección y referencias" value={address} onChangeText={setAddress} placeholder="Calle, número, colonia y referencias" multiline />
          <Field label="Costo de envío" value={deliveryFee} onChangeText={setDeliveryFee} placeholder="0" keyboardType="decimal-pad" prefix="$" />
        </>
      ) : null}

      {serviceType !== 'dine_in' ? (
        <>
          <Text style={styles.fieldLabel}>¿Cómo llegó?</Text>
          <SegmentedControl
            options={serviceType === 'delivery' ? sourceOptions.filter((option) => option.value !== 'counter') : sourceOptions}
            value={source}
            onChange={setSource}
          />
        </>
      ) : null}

      <Text style={styles.fieldLabel}>Forma de pago</Text>
      <SegmentedControl options={paymentOptions} value={paymentMethod} onChange={setPaymentMethod} />

      <Text style={styles.fieldLabel}>Estado del pago</Text>
      <SegmentedControl options={paymentStatusOptions} value={paymentStatus} onChange={setPaymentStatus} />

      {paymentMethod === 'cash' ? (
        <View style={styles.paymentBox}>
          <Field
            label={paymentStatus === 'pending' ? 'El cliente pagará con (opcional)' : 'El cliente paga con'}
            value={cashReceived}
            onChangeText={setCashReceived}
            placeholder={String(total)}
            keyboardType="decimal-pad"
            prefix="$"
          />
          <View style={styles.changeRow}>
            <Text style={styles.changeLabel}>Cambio</Text>
            <Text style={styles.changeValue}>{formatMoney(Math.max(0, receivedAmount - total))}</Text>
          </View>
        </View>
      ) : null}

      {paymentMethod === 'mixed' ? (
        <View style={styles.paymentBox}>
          <Field
            label={paymentStatus === 'pending' ? 'Parte en efectivo (opcional)' : 'Parte recibida en efectivo'}
            value={cashPart}
            onChangeText={setCashPart}
            placeholder="0"
            keyboardType="decimal-pad"
            prefix="$"
          />
          <View style={styles.mixedSummary}>
            <View>
              <Text style={styles.mixedLabel}>Efectivo</Text>
              <Text style={styles.mixedValue}>{formatMoney(cashPartAmount)}</Text>
            </View>
            <MaterialIcons name="add" size={18} color={AppColors.muted} />
            <View style={styles.mixedRight}>
              <Text style={styles.mixedLabel}>Transferencia</Text>
              <Text style={styles.mixedValue}>{formatMoney(mixedTransferAmount)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <Field
        label="Notas para la orden o entrega"
        value={notes}
        onChangeText={setNotes}
        onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
        placeholder="Sin cebolla, salsa aparte, portón azul…"
        multiline
      />

      <View style={styles.totalCard}>
        <View style={styles.totalLine}><Text style={styles.totalLabel}>Productos</Text><Text style={styles.totalValue}>{formatMoney(subtotal)}</Text></View>
        {serviceType === 'delivery' ? (
          <View style={styles.totalLine}><Text style={styles.totalLabel}>Envío</Text><Text style={styles.totalValue}>{formatMoney(fee)}</Text></View>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.totalLine}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandValue}>{formatMoney(total)}</Text></View>
      </View>

      <Pressable disabled={saving} onPress={submit} style={[styles.save, saving && styles.saveDisabled]}>
        <MaterialIcons name="send" size={20} color="#FFFFFF" />
        <Text style={styles.saveText}>
          {saving
            ? 'Guardando…'
            : editingOrder
              ? paymentStatus === 'paid'
                ? 'Guardar y registrar como pagada'
                : 'Guardar cambios'
              : paymentStatus === 'paid'
                ? 'Registrar venta'
                : 'Guardar cuenta pendiente'}
        </Text>
      </Pressable>

      <WhatsAppOrderImportModal
        visible={importVisible}
        initialText={importText}
        categories={categories}
        products={products}
        onClose={() => setImportVisible(false)}
        onApply={applyWhatsAppImport}
      />
    </AppScreen>
  );
}

export default function NewOrderScreen() {
  return <OrderFormScreen />;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Field({ label, prefix, ...props }: React.ComponentProps<typeof TextInput> & { label: string; prefix?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor="#A4978E"
          {...props}
          style={[styles.input, props.multiline && styles.inputMultiline]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: AppColors.ink, fontSize: 17, fontWeight: '900', marginBottom: 11 },
  sectionGap: { height: 26 },
  whatsAppImportCard: { marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: AppColors.greenSoft, borderWidth: 1, borderColor: '#C6E2D1', flexDirection: 'row', alignItems: 'center', gap: 10 },
  whatsAppImportIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  whatsAppImportCopy: { flex: 1 },
  whatsAppImportTitle: { color: AppColors.ink, fontSize: 13, fontWeight: '900' },
  whatsAppImportText: { color: AppColors.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  whatsAppImportButton: { minHeight: 42, paddingHorizontal: 12, borderRadius: 13, backgroundColor: AppColors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  whatsAppImportButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, minHeight: 40, borderRadius: 13, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.line },
  categorySelected: { backgroundColor: AppColors.ink, borderColor: AppColors.ink },
  categoryEmoji: { fontSize: 16 },
  categoryText: { color: AppColors.ink, fontWeight: '800', fontSize: 12 },
  categoryTextSelected: { color: '#FFFFFF' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productCard: { minHeight: 122, backgroundColor: AppColors.surface, borderRadius: 16, borderWidth: 1, borderColor: AppColors.line, overflow: 'hidden' },
  productSelected: { borderColor: AppColors.orange, borderWidth: 2 },
  productMain: { flex: 1, padding: 14 },
  productName: { color: AppColors.ink, fontWeight: '900', fontSize: 15 },
  productDetail: { color: AppColors.muted, fontSize: 11, marginTop: 3 },
  productPrice: { color: AppColors.orange, fontWeight: '900', fontSize: 17, marginTop: 9 },
  orderFive: { backgroundColor: '#FFF0E8', paddingVertical: 8, alignItems: 'center' },
  orderFiveText: { color: AppColors.orangeDark, fontWeight: '900', fontSize: 11 },
  inCart: { position: 'absolute', right: 8, top: 8, color: AppColors.green, fontWeight: '900', fontSize: 10 },
  cart: { marginTop: 16, backgroundColor: AppColors.ink, padding: 16, borderRadius: 18 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  cartTotal: { color: AppColors.yellow, fontSize: 18, fontWeight: '900' },
  cartRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58, borderTopWidth: 1, borderTopColor: '#443C37' },
  cartCopy: { flex: 1 },
  cartName: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, lineHeight: 18, paddingRight: 4 },
  cartPrice: { color: '#BFB4AC', fontSize: 11, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  removeItemButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4B302D', marginLeft: 2 },
  stepValue: { color: '#FFFFFF', fontWeight: '900', minWidth: 18, textAlign: 'center' },
  fieldWrap: { marginBottom: 13 },
  fieldLabel: { color: AppColors.ink, fontWeight: '800', fontSize: 13, marginTop: 14, marginBottom: 7 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppColors.surface, borderRadius: 13, borderWidth: 1, borderColor: AppColors.line },
  prefix: { color: AppColors.muted, paddingLeft: 14, fontWeight: '800' },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, color: AppColors.ink, fontSize: 15 },
  inputMultiline: { minHeight: 86, textAlignVertical: 'top', paddingTop: 13 },
  paymentBox: { marginTop: 13, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface },
  changeRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 12, backgroundColor: AppColors.greenSoft },
  changeLabel: { color: AppColors.green, fontWeight: '800' },
  changeValue: { color: AppColors.green, fontSize: 21, fontWeight: '900' },
  mixedSummary: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#EAF4FA' },
  mixedLabel: { color: AppColors.muted, fontSize: 11, fontWeight: '700' },
  mixedValue: { color: AppColors.ink, fontSize: 17, fontWeight: '900', marginTop: 3 },
  mixedRight: { alignItems: 'flex-end' },
  totalCard: { backgroundColor: '#FFF0E8', borderRadius: 17, padding: 17, marginTop: 22, gap: 8 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: AppColors.muted },
  totalValue: { color: AppColors.ink, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#F1D5C5', marginVertical: 3 },
  grandLabel: { color: AppColors.ink, fontSize: 18, fontWeight: '900' },
  grandValue: { color: AppColors.orangeDark, fontSize: 25, fontWeight: '900' },
  save: { minHeight: 56, borderRadius: 16, backgroundColor: AppColors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14 },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});

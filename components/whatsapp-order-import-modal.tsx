import { AppColors, formatMoney } from '@/constants/app-theme';
import { getProductEmoji, getProductLabel } from '@/lib/product-label';
import {
  parseWhatsAppOrder,
  type WhatsAppOrderParseResult,
} from '@/lib/whatsapp-order-parser';
import type { CartItem, MenuCategory, MenuProduct } from '@/lib/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  initialText: string;
  categories: MenuCategory[];
  products: MenuProduct[];
  onClose: () => void;
  onApply: (items: CartItem[], notes: string[]) => void;
};

const EMPTY_RESULT: WhatsAppOrderParseResult = {
  recognized: [],
  unresolved: [],
  notes: [],
  ignored: [],
};

export function WhatsAppOrderImportModal({
  visible,
  initialText,
  categories,
  products,
  onClose,
  onApply,
}: Props) {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<WhatsAppOrderParseResult>(EMPTY_RESULT);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const analyze = (text: string) => {
    const parsed = parseWhatsAppOrder(text, categories, products);
    setResult(parsed);
    setSelections({});
  };

  useEffect(() => {
    if (!visible) return;
    setMessage(initialText);
    analyze(initialText);
    // The modal must reset only when it is opened with new clipboard text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialText]);

  const selectedItems = useMemo(() => result.unresolved.flatMap((item) => {
    const product = item.candidates.find((candidate) => candidate.id === selections[item.id]);
    return product ? [{ product, quantity: item.quantity }] : [];
  }), [result.unresolved, selections]);

  const pendingSelections = result.unresolved.filter((item) => !selections[item.id]).length;
  const importCount = result.recognized.length + selectedItems.length;

  const pasteAnotherMessage = async () => {
    const pasted = (await Clipboard.getStringAsync()).trim();
    if (!pasted) {
      Alert.alert('No hay texto copiado', 'Copia primero el mensaje del cliente desde WhatsApp.');
      return;
    }
    if (message.trim().includes(pasted)) {
      Alert.alert('Ese mensaje ya está incluido', 'Copia el siguiente mensaje del cliente para agregarlo.');
      return;
    }
    const combined = [message.trim(), pasted].filter(Boolean).join('\n');
    setMessage(combined);
    analyze(combined);
  };

  const apply = () => {
    if (pendingSelections > 0) {
      Alert.alert('Falta completar el pedido', 'Elige una opción para cada producto marcado en amarillo.');
      return;
    }
    const items = [
      ...result.recognized.map((item) => ({ product: item.product, quantity: item.quantity })),
      ...selectedItems,
    ];
    if (items.length === 0) {
      Alert.alert('No encontré productos', 'Revisa el mensaje o agrega los productos manualmente.');
      return;
    }
    onApply(items, result.notes);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PEDIDO DE WHATSAPP</Text>
              <Text style={styles.title}>Revisa antes de agregar</Text>
            </View>
            <Pressable accessibilityLabel="Cerrar" onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={AppColors.ink} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}>
            <Text style={styles.help}>
              Puedes corregir el texto, agregar otro mensaje y volver a analizarlo.
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              placeholder="Ej. 3 tacos de pastor y una tlayuda de arrachera, todo sin cebolla"
              placeholderTextColor="#A4978E"
              style={styles.messageInput}
            />
            <View style={styles.actionRow}>
              <Pressable onPress={() => analyze(message)} style={styles.secondaryButton}>
                <MaterialIcons name="manage-search" size={19} color={AppColors.ink} />
                <Text style={styles.secondaryButtonText}>Analizar</Text>
              </Pressable>
              <Pressable onPress={pasteAnotherMessage} style={styles.secondaryButton}>
                <MaterialIcons name="content-paste" size={18} color={AppColors.ink} />
                <Text style={styles.secondaryButtonText}>Agregar mensaje</Text>
              </Pressable>
            </View>

            {result.recognized.length > 0 ? (
              <View style={styles.resultSection}>
                <Text style={styles.sectionTitle}>Detectado correctamente</Text>
                {result.recognized.map((item) => (
                  <View key={item.id} style={styles.detectedRow}>
                    <View style={styles.detectedCopy}>
                      <Text style={styles.detectedName}>
                        {getProductEmoji(item.product, categories)} {item.quantity} × {getProductLabel(item.product, categories)}
                      </Text>
                      <Text style={styles.sourceText}>“{item.sourceText}”</Text>
                    </View>
                    <Text style={styles.detectedPrice}>{formatMoney(item.product.price * item.quantity)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {result.unresolved.map((item) => (
              <View key={item.id} style={styles.unresolvedCard}>
                <View style={styles.warningHeader}>
                  <MaterialIcons name="help-outline" size={20} color="#8A5A00" />
                  <Text style={styles.warningTitle}>¿Cuál producto es?</Text>
                </View>
                <Text style={styles.sourceText}>“{item.sourceText}” · Cantidad: {item.quantity}</Text>
                <View style={styles.candidateList}>
                  {item.candidates.map((product) => {
                    const selected = selections[item.id] === product.id;
                    return (
                      <Pressable
                        key={product.id}
                        onPress={() => setSelections((current) => ({ ...current, [item.id]: product.id }))}
                        style={[styles.candidate, selected && styles.candidateSelected]}>
                        <Text style={[styles.candidateText, selected && styles.candidateTextSelected]}>
                          {getProductEmoji(product, categories)} {getProductLabel(product, categories)} · {formatMoney(product.price)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {result.notes.length > 0 ? (
              <View style={styles.noteCard}>
                <MaterialIcons name="sticky-note-2" size={20} color={AppColors.blue} />
                <View style={styles.detectedCopy}>
                  <Text style={styles.noteTitle}>Notas detectadas</Text>
                  <Text style={styles.noteText}>{result.notes.join('\n')}</Text>
                </View>
              </View>
            ) : null}

            {result.ignored.length > 0 ? (
              <View style={styles.ignoredCard}>
                <Text style={styles.ignoredTitle}>Texto que debes revisar</Text>
                <Text style={styles.ignoredText}>{result.ignored.map((text) => `• ${text}`).join('\n')}</Text>
                <Text style={styles.ignoredHelp}>Esta parte no se aplicará sola; haz el cambio manualmente en la orden.</Text>
              </View>
            ) : null}

            {result.recognized.length === 0 && result.unresolved.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="search-off" size={28} color={AppColors.muted} />
                <Text style={styles.emptyTitle}>No pude identificar productos</Text>
                <Text style={styles.emptyText}>Puedes corregir el mensaje o cerrar y capturar la orden manualmente.</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerHint}>
              {pendingSelections > 0
                ? `Falta${pendingSelections === 1 ? '' : 'n'} ${pendingSelections} selección${pendingSelections === 1 ? '' : 'es'}`
                : `${importCount} producto${importCount === 1 ? '' : 's'} listo${importCount === 1 ? '' : 's'}`}
            </Text>
            <Pressable
              disabled={pendingSelections > 0 || importCount === 0}
              onPress={apply}
              style={[styles.applyButton, (pendingSelections > 0 || importCount === 0) && styles.applyButtonDisabled]}>
              <MaterialIcons name="add-shopping-cart" size={20} color="#FFFFFF" />
              <Text style={styles.applyButtonText}>Agregar a la orden</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.paper },
  fill: { flex: 1 },
  header: { minHeight: 82, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: AppColors.line },
  headerCopy: { flex: 1 },
  eyebrow: { color: AppColors.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: AppColors.ink, fontSize: 23, fontWeight: '900', marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: AppColors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: AppColors.line },
  content: { padding: 18, paddingBottom: 28 },
  help: { color: AppColors.muted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  messageInput: { minHeight: 116, borderRadius: 16, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface, color: AppColors.ink, fontSize: 15, lineHeight: 21, padding: 14 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  secondaryButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface },
  secondaryButtonText: { color: AppColors.ink, fontSize: 12, fontWeight: '900' },
  resultSection: { marginTop: 22 },
  sectionTitle: { color: AppColors.ink, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  detectedRow: { minHeight: 68, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: AppColors.line },
  detectedCopy: { flex: 1 },
  detectedName: { color: AppColors.ink, fontSize: 14, fontWeight: '900', lineHeight: 19 },
  detectedPrice: { color: AppColors.orangeDark, fontWeight: '900', marginLeft: 10 },
  sourceText: { color: AppColors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  unresolvedCard: { marginTop: 15, padding: 14, borderRadius: 16, backgroundColor: '#FFF4D8', borderWidth: 1, borderColor: '#EBCB78' },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  warningTitle: { color: '#714A00', fontSize: 15, fontWeight: '900' },
  candidateList: { marginTop: 11, gap: 7 },
  candidate: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3CF9B' },
  candidateSelected: { backgroundColor: AppColors.ink, borderColor: AppColors.ink },
  candidateText: { color: AppColors.ink, fontSize: 12, fontWeight: '800' },
  candidateTextSelected: { color: '#FFFFFF' },
  noteCard: { marginTop: 16, padding: 14, borderRadius: 15, backgroundColor: '#EAF4FA', flexDirection: 'row', gap: 10 },
  noteTitle: { color: AppColors.blue, fontWeight: '900', fontSize: 13 },
  noteText: { color: AppColors.ink, fontSize: 12, lineHeight: 18, marginTop: 3 },
  ignoredCard: { marginTop: 13, padding: 14, borderRadius: 15, backgroundColor: AppColors.redSoft },
  ignoredTitle: { color: AppColors.red, fontWeight: '900', fontSize: 13 },
  ignoredText: { color: AppColors.ink, fontSize: 12, lineHeight: 18, marginTop: 5 },
  ignoredHelp: { color: AppColors.red, fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 7 },
  emptyCard: { marginTop: 24, padding: 22, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface },
  emptyTitle: { color: AppColors.ink, fontWeight: '900', fontSize: 15, marginTop: 8 },
  emptyText: { color: AppColors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 4 },
  footer: { padding: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: AppColors.surface, borderTopWidth: 1, borderTopColor: AppColors.line },
  footerHint: { flex: 1, color: AppColors.muted, fontSize: 11, fontWeight: '700' },
  applyButton: { minHeight: 50, borderRadius: 15, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: AppColors.orange },
  applyButtonDisabled: { opacity: 0.4 },
  applyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});

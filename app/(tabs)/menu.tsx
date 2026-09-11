import { AppScreen } from '@/components/app-screen';
import { AppColors, formatMoney } from '@/constants/app-theme';
import { useAppData } from '@/lib/store';
import type { MenuCategory, MenuProduct } from '@/lib/types';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function MenuScreen() {
  const {
    categories,
    products,
    saveProduct,
    toggleProduct,
    deleteProduct,
    createCategory,
    saveCategory,
    deleteCategory,
  } = useAppData();
  const [productModal, setProductModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [editing, setEditing] = useState<MenuProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [detail, setDetail] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [active, setActive] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [newEmoji, setNewEmoji] = useState('🍽️');

  const openNewCategory = () => {
    setEditingCategory(null);
    setNewCategory('');
    setNewEmoji('🍽️');
    setCategoryModal(true);
  };

  const openEditCategory = (category: MenuCategory) => {
    setEditingCategory(category);
    setNewCategory(category.name);
    setNewEmoji(category.emoji);
    setCategoryModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setName('');
    setPrice('');
    setDetail('');
    setCategoryId(categories[0]?.id ?? '');
    setActive(true);
    setProductModal(true);
  };

  const openEdit = (product: MenuProduct) => {
    setEditing(product);
    setName(product.name);
    setPrice(String(product.price));
    setDetail(product.detail);
    setCategoryId(product.categoryId);
    setActive(product.active);
    setProductModal(true);
  };

  const submitProduct = async () => {
    const numericPrice = Number(price);
    if (!name.trim() || !categoryId || !Number.isFinite(numericPrice) || numericPrice < 0) {
      Alert.alert('Revisa el producto', 'Escribe un nombre, una categoría y un precio válido.');
      return;
    }
    await saveProduct({
      id: editing?.id,
      categoryId,
      name,
      price: numericPrice,
      detail,
      active,
    });
    setProductModal(false);
  };

  const submitCategory = async () => {
    if (!newCategory.trim()) {
      Alert.alert('Falta el nombre', 'Escribe el nombre de la nueva categoría.');
      return;
    }
    if (editingCategory) {
      await saveCategory(editingCategory.id, newCategory, newEmoji);
    } else {
      await createCategory(newCategory, newEmoji);
    }
    setNewCategory('');
    setNewEmoji('🍽️');
    setCategoryModal(false);
  };

  const confirmDeleteProduct = () => {
    if (!editing) return;
    Alert.alert(
      `Eliminar ${editing.name}`,
      'Se quitará del menú. Las órdenes anteriores conservarán el nombre y precio que tenían.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar producto',
          style: 'destructive',
          onPress: () => deleteProduct(editing.id).then(() => setProductModal(false)),
        },
      ]
    );
  };

  const confirmDeleteCategory = () => {
    if (!editingCategory) return;
    const count = products.filter((product) => product.categoryId === editingCategory.id).length;
    Alert.alert(
      `Eliminar categoría “${editingCategory.name}”`,
      count > 0
        ? `También se quitarán sus ${count} productos del menú. El historial de órdenes no se modificará.`
        : 'La categoría se eliminará del menú.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar categoría',
          style: 'destructive',
          onPress: () => deleteCategory(editingCategory.id)
            .then(() => setCategoryModal(false))
            .catch(() => Alert.alert('No se puede eliminar', 'Debe existir al menos una categoría en el menú.')),
        },
      ]
    );
  };

  return (
    <AppScreen
      title="Menú"
      subtitle={`${products.filter((product) => product.active).length} productos disponibles`}
      action={(
        <Pressable onPress={openNew} style={styles.addButton}>
          <MaterialIcons name="add" color="#FFFFFF" size={24} />
        </Pressable>
      )}>
      <View style={styles.actionsRow}>
        <Pressable onPress={openNew} style={styles.primaryAction}>
          <MaterialIcons name="add-circle-outline" color="#FFFFFF" size={19} />
          <Text style={styles.primaryActionText}>Nuevo producto</Text>
        </Pressable>
        <Pressable onPress={openNewCategory} style={styles.secondaryAction}>
          <MaterialIcons name="create-new-folder" color={AppColors.ink} size={19} />
          <Text style={styles.secondaryActionText}>Categoría</Text>
        </Pressable>
      </View>

      {categories.map((category) => {
        const categoryProducts = products.filter((product) => product.categoryId === category.id);
        return (
          <View key={category.id} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category.emoji} {category.name}</Text>
              <View style={styles.categoryHeaderActions}>
                <Text style={styles.categoryCount}>{categoryProducts.length}</Text>
                <Pressable
                  accessibilityLabel={`Editar categoría ${category.name}`}
                  onPress={() => openEditCategory(category)}
                  style={styles.categoryEditButton}>
                  <MaterialIcons name="edit" size={17} color={AppColors.orangeDark} />
                </Pressable>
              </View>
            </View>
            {categoryProducts.length === 0 ? (
              <Text style={styles.emptyCategory}>Esta categoría todavía no tiene productos.</Text>
            ) : null}
            {categoryProducts.map((product) => (
              <Pressable key={product.id} onPress={() => openEdit(product)} style={styles.productRow}>
                <View style={[styles.statusDot, !product.active && styles.statusDotOff]} />
                <View style={styles.productCopy}>
                  <Text style={[styles.productName, !product.active && styles.productNameOff]}>{product.name}</Text>
                  <Text style={styles.productMeta}>{product.detail || (product.active ? 'Disponible' : 'No disponible')}</Text>
                </View>
                <Text style={[styles.productPrice, !product.active && styles.productNameOff]}>{formatMoney(product.price)}</Text>
                <MaterialIcons name="edit" size={18} color={AppColors.muted} />
              </Pressable>
            ))}
          </View>
        );
      })}

      <Modal visible={productModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setProductModal(false)}>
        <View style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setProductModal(false)}><Text style={styles.cancel}>Cancelar</Text></Pressable>
            <Text style={styles.modalTitle}>{editing ? 'Editar producto' : 'Nuevo producto'}</Text>
            <Pressable onPress={submitProduct}><Text style={styles.done}>Guardar</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <ModalLabel text="Nombre" />
            <TextInput value={name} onChangeText={setName} placeholder="Ej. Taco de suadero" placeholderTextColor="#A4978E" style={styles.input} />

            <ModalLabel text="Precio" />
            <View style={styles.priceInput}>
              <Text style={styles.currency}>$</Text>
              <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#A4978E" style={styles.priceField} />
            </View>

            <ModalLabel text="Detalle o presentación (opcional)" />
            <TextInput value={detail} onChangeText={setDetail} placeholder="Ej. Por taco, 600 ml, 1/2 kg" placeholderTextColor="#A4978E" style={styles.input} />

            <ModalLabel text="Categoría" />
            <View style={styles.categoryPicker}>
              {categories.filter((category) => category.active).map((category) => {
                const selected = category.id === categoryId;
                return (
                  <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.categoryChoice, selected && styles.categoryChoiceSelected]}>
                    <Text style={styles.categoryChoiceEmoji}>{category.emoji}</Text>
                    <Text style={[styles.categoryChoiceText, selected && styles.categoryChoiceTextSelected]}>{category.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>Disponible para venta</Text>
                <Text style={styles.switchText}>Puedes ocultarlo sin borrar el historial.</Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: '#D7CDC5', true: '#8BC7A7' }}
                thumbColor={active ? AppColors.green : '#FFFFFF'}
              />
            </View>

            {editing ? (
              <>
                <Pressable onPress={() => toggleProduct(editing.id, !editing.active).then(() => setProductModal(false))} style={styles.archiveButton}>
                  <Text style={styles.archiveText}>{editing.active ? 'Ocultar temporalmente' : 'Volver a mostrar'}</Text>
                </Pressable>
                <Pressable onPress={confirmDeleteProduct} style={styles.deleteButton}>
                  <MaterialIcons name="delete-outline" size={19} color={AppColors.red} />
                  <Text style={styles.deleteText}>Eliminar producto</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={categoryModal} animationType="fade" transparent onRequestClose={() => setCategoryModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</Text>
            <Text style={styles.dialogText}>
              {editingCategory
                ? 'Cambia el nombre o el emoji que identifica esta sección.'
                : 'Úsala para bebidas, postres, promociones u otros productos.'}
            </Text>
            <ModalLabel text="Emoji" />
            <TextInput value={newEmoji} onChangeText={setNewEmoji} maxLength={4} style={styles.input} />
            <ModalLabel text="Nombre" />
            <TextInput value={newCategory} onChangeText={setNewCategory} placeholder="Ej. Postres" placeholderTextColor="#A4978E" style={styles.input} />
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setCategoryModal(false)} style={styles.dialogSecondary}><Text style={styles.dialogSecondaryText}>Cancelar</Text></Pressable>
              <Pressable onPress={submitCategory} style={styles.dialogPrimary}>
                <Text style={styles.dialogPrimaryText}>{editingCategory ? 'Guardar' : 'Crear'}</Text>
              </Pressable>
            </View>
            {editingCategory ? (
              <Pressable onPress={confirmDeleteCategory} style={styles.dialogDelete}>
                <MaterialIcons name="delete-outline" size={19} color={AppColors.red} />
                <Text style={styles.deleteText}>Eliminar categoría</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function ModalLabel({ text }: { text: string }) {
  return <Text style={styles.modalLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  addButton: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.orange },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  primaryAction: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: AppColors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { color: '#FFFFFF', fontWeight: '900' },
  secondaryAction: { minHeight: 48, paddingHorizontal: 15, borderRadius: 14, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryActionText: { color: AppColors.ink, fontWeight: '900' },
  categorySection: { marginBottom: 18, backgroundColor: AppColors.surface, borderRadius: 18, borderWidth: 1, borderColor: AppColors.line, overflow: 'hidden' },
  categoryHeader: { minHeight: 50, backgroundColor: '#FFF4E7', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryTitle: { color: AppColors.ink, fontWeight: '900', fontSize: 16 },
  categoryHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryCount: { color: AppColors.orangeDark, fontWeight: '900', backgroundColor: '#FFFFFF', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  categoryEditButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  emptyCategory: { color: AppColors.muted, fontSize: 12, padding: 15, fontStyle: 'italic' },
  productRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#F3ECE6' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AppColors.green },
  statusDotOff: { backgroundColor: '#B8ADA5' },
  productCopy: { flex: 1 },
  productName: { color: AppColors.ink, fontWeight: '800', fontSize: 14 },
  productNameOff: { color: '#A59A92', textDecorationLine: 'line-through' },
  productMeta: { color: AppColors.muted, fontSize: 11, marginTop: 3 },
  productPrice: { color: AppColors.orangeDark, fontWeight: '900' },
  modalSafe: { flex: 1, backgroundColor: AppColors.paper, paddingTop: 14 },
  modalHeader: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: AppColors.line },
  modalTitle: { color: AppColors.ink, fontWeight: '900', fontSize: 17 },
  cancel: { color: AppColors.muted, fontWeight: '700' },
  done: { color: AppColors.orange, fontWeight: '900' },
  modalContent: { padding: 20, paddingBottom: 44 },
  modalLabel: { color: AppColors.ink, fontWeight: '800', fontSize: 13, marginTop: 16, marginBottom: 7 },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface, paddingHorizontal: 14, color: AppColors.ink, fontSize: 15 },
  priceInput: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: AppColors.line, backgroundColor: AppColors.surface },
  currency: { paddingLeft: 14, color: AppColors.muted, fontWeight: '900' },
  priceField: { flex: 1, paddingHorizontal: 8, color: AppColors.ink, fontSize: 16 },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChoice: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 12, borderRadius: 12, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.line },
  categoryChoiceSelected: { backgroundColor: AppColors.ink, borderColor: AppColors.ink },
  categoryChoiceEmoji: { fontSize: 16 },
  categoryChoiceText: { color: AppColors.ink, fontWeight: '800', fontSize: 12 },
  categoryChoiceTextSelected: { color: '#FFFFFF' },
  switchRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, padding: 14, backgroundColor: AppColors.surface, borderRadius: 14, borderWidth: 1, borderColor: AppColors.line },
  switchCopy: { flex: 1 },
  switchTitle: { color: AppColors.ink, fontWeight: '900' },
  switchText: { color: AppColors.muted, fontSize: 12, marginTop: 3 },
  archiveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderRadius: 13, backgroundColor: '#F2EAE4' },
  archiveText: { color: AppColors.ink, fontWeight: '800' },
  deleteButton: { minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 13, backgroundColor: AppColors.redSoft },
  deleteText: { color: AppColors.red, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: '#00000077', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: AppColors.paper, borderRadius: 22, padding: 20 },
  dialogTitle: { color: AppColors.ink, fontSize: 21, fontWeight: '900' },
  dialogText: { color: AppColors.muted, lineHeight: 19, marginTop: 5 },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  dialogSecondary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EFE7E0' },
  dialogSecondaryText: { color: AppColors.ink, fontWeight: '900' },
  dialogPrimary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: AppColors.orange },
  dialogPrimaryText: { color: '#FFFFFF', fontWeight: '900' },
  dialogDelete: { minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 13, backgroundColor: AppColors.redSoft },
});

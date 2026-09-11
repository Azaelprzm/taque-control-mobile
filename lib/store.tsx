import { createId, getLocalDateKey, getLocalDateTime } from '@/constants/app-theme';
import { initializeDatabase } from '@/lib/database';
import { getProductLabel } from '@/lib/product-label';
import type {
  MenuCategory,
  MenuProduct,
  NewOrderInput,
  Order,
  OrderItem,
} from '@/lib/types';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type StoreValue = {
  loading: boolean;
  categories: MenuCategory[];
  products: MenuProduct[];
  orders: Order[];
  refresh: () => Promise<void>;
  createOrder: (input: NewOrderInput) => Promise<Order>;
  updateOrder: (id: string, input: NewOrderInput) => Promise<void>;
  settleOrder: (id: string, payment: Pick<Order, 'cashReceived' | 'cashAmount' | 'transferAmount'>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  saveProduct: (product: Omit<MenuProduct, 'id' | 'sortOrder'> & { id?: string }) => Promise<void>;
  toggleProduct: (id: string, active: boolean) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createCategory: (name: string, emoji: string) => Promise<void>;
  saveCategory: (id: string, name: string, emoji: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

type CategoryRow = { id: string; name: string; emoji: string; sort_order: number; active: number };
type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  detail: string;
  active: number;
  sort_order: number;
};
type OrderRow = {
  id: string;
  order_number: number;
  status: Order['status'];
  service_type: Order['serviceType'];
  source: Order['source'];
  customer_name: string;
  phone: string;
  address: string;
  table_name: string;
  payment_method: Order['paymentMethod'];
  payment_status: Order['paymentStatus'];
  cash_received: number;
  cash_amount: number;
  transfer_amount: number;
  notes: string;
  delivery_fee: number;
  created_at: string;
};
type ItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  notes: string;
};

function StoreProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const refresh = useCallback(async () => {
    const [categoryRows, productRows, orderRows, itemRows] = await Promise.all([
      db.getAllAsync<CategoryRow>('SELECT * FROM categories ORDER BY sort_order, name'),
      db.getAllAsync<ProductRow>('SELECT * FROM products ORDER BY category_id, sort_order, name'),
      db.getAllAsync<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC'),
      db.getAllAsync<ItemRow>('SELECT * FROM order_items'),
    ]);

    setCategories(categoryRows.map((row) => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      sortOrder: row.sort_order,
      active: Boolean(row.active),
    })));
    setProducts(productRows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      price: row.price,
      detail: row.detail,
      active: Boolean(row.active),
      sortOrder: row.sort_order,
    })));

    const itemsByOrder = itemRows.reduce<Record<string, OrderItem[]>>((acc, row) => {
      const item: OrderItem = {
        id: row.id,
        orderId: row.order_id,
        productId: row.product_id,
        productName: row.product_name,
        unitPrice: row.unit_price,
        quantity: row.quantity,
        notes: row.notes,
      };
      (acc[row.order_id] ??= []).push(item);
      return acc;
    }, {});

    setOrders(orderRows.map((row) => ({
      id: row.id,
      number: row.order_number,
      status: row.status,
      serviceType: row.service_type,
      source: row.source,
      customerName: row.customer_name,
      phone: row.phone,
      address: row.address,
      tableName: row.table_name,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      cashReceived: row.cash_received,
      cashAmount: row.cash_amount,
      transferAmount: row.transfer_amount,
      notes: row.notes,
      deliveryFee: row.delivery_fee,
      createdAt: row.created_at,
      items: itemsByOrder[row.id] ?? [],
    })));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createOrder = useCallback(async (input: NewOrderInput) => {
    const todayOrders = orders.filter((order) => order.createdAt.startsWith(getLocalDateKey()));
    const number = Math.max(0, ...todayOrders.map((order) => order.number)) + 1;
    const id = createId('order');
    const createdAt = getLocalDateTime();
    const createdItems: OrderItem[] = input.items.map((cartItem) => ({
      id: createId('item'),
      orderId: id,
      productId: products.some((product) => product.id === cartItem.product.id)
        ? cartItem.product.id
        : null,
      productName: getProductLabel(cartItem.product, categories),
      unitPrice: cartItem.product.price,
      quantity: cartItem.quantity,
      notes: '',
    }));

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO orders (
          id, order_number, status, service_type, source, customer_name, phone, address,
          table_name, payment_method, payment_status, cash_received, cash_amount, transfer_amount,
          notes, delivery_fee, created_at
        ) VALUES (?, ?, 'recorded', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        number,
        input.serviceType,
        input.source,
        input.customerName.trim(),
        input.phone.trim(),
        input.address.trim(),
        input.tableName.trim(),
        input.paymentMethod,
        input.paymentStatus,
        input.cashReceived,
        input.cashAmount,
        input.transferAmount,
        input.notes.trim(),
        input.deliveryFee,
        createdAt
      );

      for (const item of createdItems) {
        await db.runAsync(
          `INSERT INTO order_items (
            id, order_id, product_id, product_name, unit_price, quantity, notes
          ) VALUES (?, ?, ?, ?, ?, ?, '')`,
          item.id,
          id,
          item.productId,
          item.productName,
          item.unitPrice,
          item.quantity
        );
      }
    });
    await refresh();
    return {
      id,
      number,
      status: 'recorded' as const,
      serviceType: input.serviceType,
      source: input.source,
      customerName: input.customerName.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      tableName: input.tableName.trim(),
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      cashReceived: input.cashReceived,
      cashAmount: input.cashAmount,
      transferAmount: input.transferAmount,
      notes: input.notes.trim(),
      deliveryFee: input.deliveryFee,
      createdAt,
      items: createdItems,
    };
  }, [categories, db, orders, products, refresh]);

  const updateOrder = useCallback(async (id: string, input: NewOrderInput) => {
    const current = orders.find((order) => order.id === id);
    if (!current || current.paymentStatus !== 'pending') {
      throw new Error('Only pending orders can be edited');
    }

    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        `UPDATE orders SET
          service_type = ?, source = ?, customer_name = ?, phone = ?, address = ?, table_name = ?,
          payment_method = ?, payment_status = ?, cash_received = ?, cash_amount = ?,
          transfer_amount = ?, notes = ?, delivery_fee = ?
         WHERE id = ? AND payment_status = 'pending'`,
        input.serviceType,
        input.source,
        input.customerName.trim(),
        input.phone.trim(),
        input.address.trim(),
        input.tableName.trim(),
        input.paymentMethod,
        input.paymentStatus,
        input.cashReceived,
        input.cashAmount,
        input.transferAmount,
        input.notes.trim(),
        input.deliveryFee,
        id
      );
      if (result.changes === 0) throw new Error('Order is no longer editable');

      await db.runAsync('DELETE FROM order_items WHERE order_id = ?', id);
      for (const cartItem of input.items) {
        await db.runAsync(
          `INSERT INTO order_items (
            id, order_id, product_id, product_name, unit_price, quantity, notes
          ) VALUES (?, ?, ?, ?, ?, ?, '')`,
          createId('item'),
          id,
          products.some((product) => product.id === cartItem.product.id)
            ? cartItem.product.id
            : null,
          getProductLabel(cartItem.product, categories),
          cartItem.product.price,
          cartItem.quantity
        );
      }
    });
    await refresh();
  }, [categories, db, orders, products, refresh]);

  const settleOrder = useCallback(async (
    id: string,
    payment: Pick<Order, 'cashReceived' | 'cashAmount' | 'transferAmount'>
  ) => {
    const result = await db.runAsync(
      `UPDATE orders SET payment_status = 'paid', cash_received = ?, cash_amount = ?, transfer_amount = ?
       WHERE id = ? AND payment_status = 'pending'`,
      payment.cashReceived,
      payment.cashAmount,
      payment.transferAmount,
      id
    );
    if (result.changes === 0) throw new Error('Order is no longer pending');
    await refresh();
  }, [db, refresh]);

  const deleteOrder = useCallback(async (id: string) => {
    const result = await db.runAsync(
      "DELETE FROM orders WHERE id = ? AND payment_status = 'pending'",
      id
    );
    if (result.changes === 0) throw new Error('Only pending orders can be deleted');
    await refresh();
  }, [db, refresh]);

  const saveProduct = useCallback(async (
    product: Omit<MenuProduct, 'id' | 'sortOrder'> & { id?: string }
  ) => {
    if (product.id) {
      await db.runAsync(
        `UPDATE products
         SET category_id = ?, name = ?, price = ?, detail = ?, active = ?
         WHERE id = ?`,
        product.categoryId,
        product.name.trim(),
        product.price,
        product.detail.trim(),
        product.active ? 1 : 0,
        product.id
      );
    } else {
      const maxOrder = products
        .filter((item) => item.categoryId === product.categoryId)
        .reduce((max, item) => Math.max(max, item.sortOrder), 0);
      await db.runAsync(
        `INSERT INTO products (id, category_id, name, price, detail, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        createId('product'),
        product.categoryId,
        product.name.trim(),
        product.price,
        product.detail.trim(),
        product.active ? 1 : 0,
        maxOrder + 1
      );
    }
    await refresh();
  }, [db, products, refresh]);

  const toggleProduct = useCallback(async (id: string, active: boolean) => {
    await db.runAsync('UPDATE products SET active = ? WHERE id = ?', active ? 1 : 0, id);
    await refresh();
  }, [db, refresh]);

  const deleteProduct = useCallback(async (id: string) => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE order_items SET product_id = NULL WHERE product_id = ?', id);
      await db.runAsync('DELETE FROM products WHERE id = ?', id);
    });
    await refresh();
  }, [db, refresh]);

  const createCategory = useCallback(async (name: string, emoji: string) => {
    const maxOrder = categories.reduce((max, item) => Math.max(max, item.sortOrder), 0);
    await db.runAsync(
      'INSERT INTO categories (id, name, emoji, sort_order) VALUES (?, ?, ?, ?)',
      createId('category'),
      name.trim(),
      emoji.trim() || '🍽️',
      maxOrder + 1
    );
    await refresh();
  }, [categories, db, refresh]);

  const saveCategory = useCallback(async (id: string, name: string, emoji: string) => {
    await db.runAsync(
      'UPDATE categories SET name = ?, emoji = ? WHERE id = ?',
      name.trim(),
      emoji.trim() || '🍽️',
      id
    );
    await refresh();
  }, [db, refresh]);

  const deleteCategory = useCallback(async (id: string) => {
    if (categories.length <= 1) throw new Error('At least one category is required');
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'UPDATE order_items SET product_id = NULL WHERE product_id IN (SELECT id FROM products WHERE category_id = ?)',
        id
      );
      await db.runAsync('DELETE FROM products WHERE category_id = ?', id);
      await db.runAsync('DELETE FROM categories WHERE id = ?', id);
    });
    await refresh();
  }, [categories.length, db, refresh]);

  const value = useMemo(() => ({
    loading,
    categories,
    products,
    orders,
    refresh,
    createOrder,
    updateOrder,
    settleOrder,
    deleteOrder,
    saveProduct,
    toggleProduct,
    deleteProduct,
    createCategory,
    saveCategory,
    deleteCategory,
  }), [
    loading,
    categories,
    products,
    orders,
    refresh,
    createOrder,
    updateOrder,
    settleOrder,
    deleteOrder,
    saveProduct,
    toggleProduct,
    deleteProduct,
    createCategory,
    saveCategory,
    deleteCategory,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function AppDataProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName="taqueria-kar.db" onInit={initializeDatabase}>
      <StoreProvider>{children}</StoreProvider>
    </SQLiteProvider>
  );
}

export function useAppData() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}

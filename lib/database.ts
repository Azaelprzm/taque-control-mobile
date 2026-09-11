import type { SQLiteDatabase } from 'expo-sqlite';

const categories = [
  ['tacos', 'Tacos', '🌮', 1],
  ['tortas', 'Tortas', '🥙', 2],
  ['gringas', 'Gringas', '🫓', 3],
  ['tlayudas', 'Tlayudas', '🌯', 4],
  ['alambres', 'Alambres', '🍢', 5],
  ['tostadas', 'Tostadas', '🥘', 6],
  ['bebidas', 'Bebidas', '🥤', 7],
  ['kilos', 'Carne por kilo', '🥩', 8],
] as const;

const products = [
  ['taco-arrachera', 'tacos', 'Arrachera', 18, 'Por taco', 1],
  ['taco-costilla', 'tacos', 'Costilla', 18, 'Por taco', 2],
  ['taco-pastor', 'tacos', 'Pastor', 14, 'Por taco', 3],
  ['torta-arrachera', 'tortas', 'Arrachera', 55, '', 1],
  ['torta-costilla', 'tortas', 'Costilla', 55, '', 2],
  ['torta-pastor', 'tortas', 'Pastor', 55, '', 3],
  ['torta-chorizo', 'tortas', 'Chorizo', 55, '', 4],
  ['gringa-arrachera', 'gringas', 'Arrachera', 35, '', 1],
  ['gringa-costilla', 'gringas', 'Costilla', 35, '', 2],
  ['gringa-pastor', 'gringas', 'Pastor', 30, '', 3],
  ['gringa-chorizo', 'gringas', 'Chorizo', 35, '', 4],
  ['tlayuda-chorizo', 'tlayudas', 'Chorizo', 100, '', 1],
  ['tlayuda-arrachera', 'tlayudas', 'Arrachera', 100, '', 2],
  ['tlayuda-costilla', 'tlayudas', 'Costilla', 100, '', 3],
  ['tlayuda-pastor', 'tlayudas', 'Pastor', 95, '', 4],
  ['tlayuda-sencilla', 'tlayudas', 'Sencilla', 75, '', 5],
  ['alambre-pastor', 'alambres', 'Pastor', 90, '', 1],
  ['alambre-arrachera', 'alambres', 'Arrachera', 100, '', 2],
  ['alambre-costilla', 'alambres', 'Costilla', 100, '', 3],
  ['alambre-choriqueso', 'alambres', 'Choriqueso', 100, '', 4],
  ['tostada-pastor', 'tostadas', 'Pastor', 55, '', 1],
  ['tostada-arrachera', 'tostadas', 'Arrachera', 55, '', 2],
  ['tostada-costilla', 'tostadas', 'Costilla', 55, '', 3],
  ['tostada-chorizo', 'tostadas', 'Chorizo', 55, '', 4],
  ['agua-vaso', 'bebidas', 'Vaso de agua', 20, '', 1],
  ['agua-jarra', 'bebidas', 'Jarra de agua', 70, '', 2],
  ['malteada', 'bebidas', 'Malteada', 50, '', 3],
  ['coca-600', 'bebidas', 'Coca-Cola 600 ml', 30, '', 4],
  ['coca-2500', 'bebidas', 'Coca-Cola 2.5 L', 60, '', 5],
  ['arrachera-cuarto', 'kilos', 'Arrachera · 1/4 kg', 120, '', 1],
  ['arrachera-medio', 'kilos', 'Arrachera · 1/2 kg', 240, '', 2],
  ['arrachera-kilo', 'kilos', 'Arrachera · 1 kg', 480, '', 3],
  ['costilla-kilo', 'kilos', 'Costilla · 1 kg', 480, '', 4],
  ['pastor-cuarto', 'kilos', 'Pastor · 1/4 kg', 105, '', 5],
  ['pastor-medio', 'kilos', 'Pastor · 1/2 kg', 210, '', 6],
  ['pastor-kilo', 'kilos', 'Pastor · 1 kg', 420, '', 7],
] as const;

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🍽️',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      order_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      service_type TEXT NOT NULL,
      source TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      table_name TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      delivery_fee REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if ((existing?.count ?? 0) === 0) {
    await db.withTransactionAsync(async () => {
      for (const category of categories) {
        await db.runAsync(
          'INSERT INTO categories (id, name, emoji, sort_order) VALUES (?, ?, ?, ?)',
          ...category
        );
      }
      for (const product of products) {
        await db.runAsync(
          'INSERT INTO products (id, category_id, name, price, detail, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
          ...product
        );
      }
    });
  }

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        UPDATE orders SET status = 'recorded' WHERE status != 'cancelled';

        UPDATE order_items
        SET product_name = CASE
          WHEN (SELECT category_id FROM products WHERE products.id = order_items.product_id) = 'tacos'
            AND lower(product_name) NOT LIKE 'taco %' THEN 'Taco de ' || product_name
          WHEN (SELECT category_id FROM products WHERE products.id = order_items.product_id) = 'tortas'
            AND lower(product_name) NOT LIKE 'torta %' THEN 'Torta de ' || product_name
          WHEN (SELECT category_id FROM products WHERE products.id = order_items.product_id) = 'gringas'
            AND lower(product_name) NOT LIKE 'gringa %' THEN 'Gringa de ' || product_name
          WHEN (SELECT category_id FROM products WHERE products.id = order_items.product_id) = 'tlayudas'
            AND lower(product_name) = 'sencilla' THEN 'Tlayuda sencilla'
          WHEN (SELECT category_id FROM products WHERE products.id = order_items.product_id) = 'tlayudas'
            AND lower(product_name) NOT LIKE 'tlayuda %' THEN 'Tlayuda de ' || product_name
          WHEN (SELECT category_id FROM products WHERE products.id = order_items.product_id) = 'alambres'
            AND lower(product_name) NOT LIKE 'alambre %' THEN 'Alambre de ' || product_name
          WHEN (SELECT category_id FROM products WHERE products.id = order_items.product_id) = 'tostadas'
            AND lower(product_name) NOT LIKE 'tostada %' THEN 'Tostada de ' || product_name
          ELSE product_name
        END
        WHERE product_id IS NOT NULL;

        PRAGMA user_version = 1;
      `);
    });
  }

  if ((version?.user_version ?? 0) < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE orders ADD COLUMN cash_received REAL NOT NULL DEFAULT 0;
        ALTER TABLE orders ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0;
        ALTER TABLE orders ADD COLUMN transfer_amount REAL NOT NULL DEFAULT 0;
        PRAGMA user_version = 2;
      `);
    });
  }
}

export type OrderStatus = 'recorded' | 'cancelled';
export type ServiceType = 'delivery' | 'dine_in' | 'pickup';
export type OrderSource = 'whatsapp' | 'phone' | 'counter';
export type PaymentMethod = 'cash' | 'transfer' | 'mixed';
export type PaymentStatus = 'paid' | 'pending';

export type MenuCategory = {
  id: string;
  name: string;
  emoji: string;
  sortOrder: number;
  active: boolean;
};

export type MenuProduct = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  detail: string;
  active: boolean;
  sortOrder: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes: string;
};

export type Order = {
  id: string;
  number: number;
  status: OrderStatus;
  serviceType: ServiceType;
  source: OrderSource;
  customerName: string;
  phone: string;
  address: string;
  tableName: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashReceived: number;
  cashAmount: number;
  transferAmount: number;
  notes: string;
  deliveryFee: number;
  createdAt: string;
  items: OrderItem[];
};

export type CartItem = {
  product: MenuProduct;
  quantity: number;
};

export type NewOrderInput = {
  serviceType: ServiceType;
  source: OrderSource;
  customerName: string;
  phone: string;
  address: string;
  tableName: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashReceived: number;
  cashAmount: number;
  transferAmount: number;
  notes: string;
  deliveryFee: number;
  items: CartItem[];
};

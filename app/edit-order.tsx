import { OrderFormScreen } from '@/app/(tabs)/new-order';
import { useLocalSearchParams } from 'expo-router';

export default function EditOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return <OrderFormScreen orderId={orderId} />;
}

import { ref } from 'vue'

// Module-level ref so all components share the same list (singleton pattern, same as useFilters.js)
const restockOrders = ref([])

export function useRestockOrders() {
  const submitOrder = (selectedItems) => {
    const now = new Date()
    const delivery = new Date(now)
    // Fixed 14-day lead time for all restock orders
    delivery.setDate(delivery.getDate() + 14)

    const order = {
      id: `RST-${Date.now()}`,
      order_number: `RST-${now.getFullYear()}-${String(restockOrders.value.length + 1).padStart(4, '0')}`,
      items: selectedItems.map(i => ({
        sku: i.item_sku,
        name: i.item_name,
        quantity: i.forecasted_demand,
        unit_price: i.unit_cost
      })),
      status: 'Processing',
      order_date: now.toISOString(),
      expected_delivery: delivery.toISOString(),
      total_value: selectedItems.reduce((sum, i) => sum + i.forecasted_demand * i.unit_cost, 0)
    }

    restockOrders.value.push(order)
  }

  return { restockOrders, submitOrder }
}

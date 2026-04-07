<template>
  <div class="restocking">
    <div class="page-header">
      <h2>Restocking Planner</h2>
      <p>Allocate your budget to recommended restock items based on demand forecasts.</p>
    </div>

    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Budget Slider Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Available Budget</h3>
          <span class="budget-display">${{ budget.toLocaleString() }}</span>
        </div>
        <div class="budget-slider-section">
          <input
            type="range"
            min="0"
            max="500000"
            step="5000"
            v-model.number="budget"
            class="budget-slider"
          />
          <div class="budget-meta">
            <span class="budget-spend-label">
              Recommended spend: ${{ recommendations.totalSpend.toLocaleString() }} of ${{ budget.toLocaleString() }} budget
            </span>
          </div>
          <div class="budget-progress-track">
            <div
              class="budget-progress-fill"
              :style="{ width: budget > 0 ? Math.min(recommendations.totalSpend / budget * 100, 100) + '%' : '0%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Success Banner -->
      <div v-if="orderSubmitted" class="success-banner">
        Order placed! View it in the Orders tab.
        <button class="reset-link" @click="orderSubmitted = false">Place another order</button>
      </div>

      <!-- Recommendations Table Card -->
      <div class="card" v-if="recommendations.included.length > 0">
        <div class="card-header">
          <h3 class="card-title">Recommended Items ({{ recommendations.included.length }})</h3>
        </div>
        <div class="table-container">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>SKU</th>
                <th>Trend</th>
                <th>Qty to Order</th>
                <th>Unit Cost</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in recommendations.included"
                :key="item.item_sku"
                class="recommended-row"
              >
                <td>{{ item.item_name }}</td>
                <td><code class="sku-code">{{ item.item_sku }}</code></td>
                <td>
                  <span :class="['badge', getTrendBadgeClass(item.trend)]">{{ item.trend }}</span>
                </td>
                <td>{{ item.forecasted_demand.toLocaleString() }}</td>
                <td>${{ item.unit_cost.toLocaleString() }}</td>
                <td><strong>${{ (item.forecasted_demand * item.unit_cost).toLocaleString() }}</strong></td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="5" class="total-label">Total Spend</td>
                <td><strong>${{ recommendations.totalSpend.toLocaleString() }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="card empty-state">
        <p>Increase your budget to see recommendations.</p>
      </div>

      <!-- Skipped Items -->
      <div v-if="recommendations.skipped.length > 0" class="card skipped-card">
        <details>
          <summary class="skipped-summary">{{ recommendations.skipped.length }} items exceed budget</summary>
          <ul class="skipped-list">
            <li v-for="item in recommendations.skipped" :key="item.item_sku" class="skipped-item">
              <span class="skipped-name">{{ item.item_name }}</span>
              <span class="skipped-cost">${{ (item.forecasted_demand * item.unit_cost).toLocaleString() }}</span>
            </li>
          </ul>
        </details>
      </div>

      <!-- Place Order Button -->
      <div class="order-action">
        <button
          class="btn-place-order"
          :disabled="recommendations.included.length === 0 || orderSubmitted"
          @click="handlePlaceOrder"
        >
          Place Restock Order
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useRestockOrders } from '../composables/useRestockOrders'

export default {
  name: 'Restocking',
  setup() {
    const { restockOrders, submitOrder } = useRestockOrders()

    const loading = ref(true)
    const error = ref(null)
    const forecasts = ref([])
    const inventory = ref([])
    const budget = ref(50000)
    const orderSubmitted = ref(false)

    const enrichedForecasts = computed(() => {
      return forecasts.value.map(forecast => {
        const inventoryItem = inventory.value.find(inv => inv.sku === forecast.item_sku)
        return {
          ...forecast,
          unit_cost: inventoryItem ? inventoryItem.unit_cost : 0
        }
      })
    })

    const recommendations = computed(() => {
      const trendPriority = { increasing: 0, stable: 1, decreasing: 2 }
      const sorted = [...enrichedForecasts.value].sort((a, b) => {
        const pa = trendPriority[a.trend] !== undefined ? trendPriority[a.trend] : 3
        const pb = trendPriority[b.trend] !== undefined ? trendPriority[b.trend] : 3
        return pa - pb
      })

      const included = []
      const skipped = []
      let remaining = budget.value

      for (const item of sorted) {
        const itemCost = item.forecasted_demand * item.unit_cost
        if (remaining >= itemCost) {
          included.push(item)
          remaining -= itemCost
        } else {
          skipped.push(item)
        }
      }

      const totalSpend = budget.value - remaining
      return { included, skipped, totalSpend }
    })

    const getTrendBadgeClass = (trend) => {
      const map = {
        increasing: 'success',
        stable: 'info',
        decreasing: 'warning'
      }
      return map[trend] || 'info'
    }

    const handlePlaceOrder = () => {
      submitOrder(recommendations.value.included)
      orderSubmitted.value = true
    }

    const loadData = async () => {
      loading.value = true
      error.value = null
      try {
        const [forecastData, inventoryData] = await Promise.all([
          api.getDemandForecasts(),
          api.getInventory({})
        ])
        forecasts.value = forecastData
        inventory.value = inventoryData
      } catch (err) {
        error.value = 'Failed to load restocking data: ' + err.message
      } finally {
        loading.value = false
      }
    }

    onMounted(loadData)

    return {
      loading,
      error,
      budget,
      orderSubmitted,
      recommendations,
      getTrendBadgeClass,
      handlePlaceOrder
    }
  }
}
</script>

<style scoped>
.restocking {
  padding: 0;
}

.budget-display {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.budget-slider-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.budget-slider {
  width: 100%;
  height: 6px;
  accent-color: #2563eb;
  cursor: pointer;
}

.budget-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.budget-spend-label {
  font-size: 0.875rem;
  color: #64748b;
}

.budget-progress-track {
  width: 100%;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.budget-progress-fill {
  height: 100%;
  background: #2563eb;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.success-banner {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  padding: 0.875rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.938rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.reset-link {
  background: none;
  border: none;
  color: #059669;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.reset-link:hover {
  color: #047857;
}

.recommended-row {
  border-left: 3px solid #22c55e;
}

.sku-code {
  font-family: monospace;
  font-size: 0.813rem;
  background: #f1f5f9;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  color: #475569;
}

.total-row {
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
}

.total-label {
  font-weight: 600;
  color: #475569;
  text-align: right;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.empty-state {
  text-align: center;
  padding: 2.5rem;
  color: #64748b;
  font-size: 0.938rem;
}

.skipped-card {
  background: #fafafa;
}

.skipped-summary {
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  user-select: none;
  padding: 0.25rem 0;
}

.skipped-summary:hover {
  color: #475569;
}

.skipped-list {
  list-style: none;
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.skipped-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  background: #f1f5f9;
  font-size: 0.875rem;
}

.skipped-name {
  color: #475569;
}

.skipped-cost {
  color: #94a3b8;
  font-weight: 500;
}

.order-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
}

.btn-place-order {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 0.938rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-place-order:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-place-order:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}
</style>

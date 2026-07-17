import { apiFetch } from './api';

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });
  return query.toString() ? `?${query.toString()}` : '';
}

export function getSuppliers(token, q = '') {
  return apiFetch(`/inventory/suppliers${buildQuery({ q })}`, {}, token);
}

export function createSupplier(token, supplierData) {
  return apiFetch('/inventory/suppliers', {
    method: 'POST',
    body: JSON.stringify(supplierData),
  }, token);
}

export function getProducts(token, q = '', page = 1, page_size = 100) {
  return apiFetch(`/inventory/products${buildQuery({ q, page, page_size })}`, {}, token);
}

export function searchProductsForPO(token, q = '') {
  return apiFetch(`/inventory/products/search${buildQuery({ q, active_only: true })}`, {}, token);
}

export function createProduct(token, data) {
  return apiFetch('/inventory/products', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function updateProduct(token, productId, data) {
  return apiFetch(`/inventory/products/${productId}`, { method: 'PUT', body: JSON.stringify(data) }, token);
}

export function deactivateProduct(token, productId) {
  return apiFetch(`/inventory/products/${productId}/deactivate`, { method: 'PATCH' }, token);
}

export function activateProduct(token, productId) {
  return apiFetch(`/inventory/products/${productId}/activate`, { method: 'PATCH' }, token);
}

export function deleteProduct(token, productId) {
  return apiFetch(`/inventory/products/${productId}`, { method: 'DELETE' }, token);
}

export function getCategories(token, q = '') {
  return apiFetch(`/inventory/categories${buildQuery({ q })}`, {}, token);
}

export function createCategory(token, data) {
  return apiFetch('/inventory/categories', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function getUnits(token, q = '') {
  return apiFetch(`/inventory/units${buildQuery({ q })}`, {}, token);
}

export function createUnit(token, data) {
  return apiFetch('/inventory/units', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function getManufacturers(token, q = '') {
  return apiFetch(`/inventory/manufacturers${buildQuery({ q })}`, {}, token);
}

export function createManufacturer(token, data) {
  return apiFetch('/inventory/manufacturers', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function getBrands(token, q = '') {
  return apiFetch(`/inventory/brands${buildQuery({ q })}`, {}, token);
}

export function createBrand(token, data) {
  return apiFetch('/inventory/brands', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function getStorageLocations(token, q = '') {
  return apiFetch(`/inventory/locations${buildQuery({ q })}`, {}, token);
}

export function createStorageLocation(token, data) {
  return apiFetch('/inventory/locations', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function listPurchaseOrders(token, options = {}) {
  return apiFetch(`/inventory/purchase-orders${buildQuery(options)}`, {}, token);
}

export function getPurchaseOrder(token, purchaseOrderId) {
  return apiFetch(`/inventory/purchase-orders/${purchaseOrderId}`, {}, token);
}

export function createPurchaseOrder(token, purchaseOrderData) {
  return apiFetch('/inventory/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(purchaseOrderData),
  }, token);
}

export function listGoodsReceipts(token, options = {}) {
  return apiFetch(`/inventory/goods-receipts${buildQuery(options)}`, {}, token);
}

export function createGoodsReceipt(token, goodsReceiptData) {
  return apiFetch('/inventory/goods-receipts', {
    method: 'POST',
    body: JSON.stringify(goodsReceiptData),
  }, token);
}

export function listPurchaseRequisitions(token, options = {}) {
  return apiFetch(`/inventory/requisitions${buildQuery(options)}`, {}, token);
}

export function getPurchaseRequisition(token, requisitionId) {
  return apiFetch(`/inventory/requisitions/${requisitionId}`, {}, token);
}

export function createPurchaseRequisition(token, requisitionData) {
  return apiFetch('/inventory/requisitions', {
    method: 'POST',
    body: JSON.stringify(requisitionData),
  }, token);
}

export function updatePurchaseRequisition(token, requisitionId, requisitionData) {
  return apiFetch(`/inventory/requisitions/${requisitionId}`, {
    method: 'PUT',
    body: JSON.stringify(requisitionData),
  }, token);
}

export function approvePurchaseRequisition(token, requisitionId, approvalData = {}) {
  return apiFetch(`/inventory/requisitions/${requisitionId}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(approvalData),
  }, token);
}

export function rejectPurchaseRequisition(token, requisitionId, rejectionData) {
  return apiFetch(`/inventory/requisitions/${requisitionId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(rejectionData),
  }, token);
}

export function convertPurchaseRequisition(token, requisitionId, conversionData) {
  return apiFetch(`/inventory/requisitions/${requisitionId}/convert`, {
    method: 'POST',
    body: JSON.stringify(conversionData),
  }, token);
}

export function getInventoryStock(token, options = {}) {
  return apiFetch(`/inventory/stock${buildQuery(options)}`, {}, token);
}

export function getInventoryStockByProduct(token, productId) {
  return apiFetch(`/inventory/stock/${productId}`, {}, token);
}

export function createStockTransaction(token, transactionData) {
  return apiFetch('/inventory/stock/transactions', {
    method: 'POST',
    body: JSON.stringify(transactionData),
  }, token);
}

export function listInventoryLedger(token, options = {}) {
  return apiFetch(`/inventory/stock/ledger${buildQuery(options)}`, {}, token);
}

export function createInventoryTransfer(token, transferData) {
  return apiFetch('/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify(transferData),
  }, token);
}

export function listInventoryTransfers(token, options = {}) {
  return apiFetch(`/inventory/transfers${buildQuery(options)}`, {}, token);
}

export function getInventoryTransfer(token, transferId) {
  return apiFetch(`/inventory/transfers/${transferId}`, {}, token);
}

export function updateInventoryTransfer(token, transferId, transferData) {
  return apiFetch(`/inventory/transfers/${transferId}`, {
    method: 'PUT',
    body: JSON.stringify(transferData),
  }, token);
}

export function approveInventoryTransfer(token, transferId) {
  return apiFetch(`/inventory/transfers/${transferId}/approve`, {
    method: 'PATCH',
  }, token);
}

export function completeInventoryTransfer(token, transferId) {
  return apiFetch(`/inventory/transfers/${transferId}/complete`, {
    method: 'PATCH',
  }, token);
}

export function cancelInventoryTransfer(token, transferId) {
  return apiFetch(`/inventory/transfers/${transferId}/cancel`, {
    method: 'PATCH',
  }, token);
}

export function createStockAdjustment(token, adjustmentData) {
  return apiFetch('/inventory/adjustments', {
    method: 'POST',
    body: JSON.stringify(adjustmentData),
  }, token);
}

export function listStockAdjustments(token, options = {}) {
  return apiFetch(`/inventory/adjustments${buildQuery(options)}`, {}, token);
}

export function getStockAdjustment(token, adjustmentId) {
  return apiFetch(`/inventory/adjustments/${adjustmentId}`, {}, token);
}

export function updateStockAdjustment(token, adjustmentId, adjustmentData) {
  return apiFetch(`/inventory/adjustments/${adjustmentId}`, {
    method: 'PUT',
    body: JSON.stringify(adjustmentData),
  }, token);
}

export function approveStockAdjustment(token, adjustmentId) {
  return apiFetch(`/inventory/adjustments/${adjustmentId}/approve`, {
    method: 'PATCH',
  }, token);
}

export function cancelStockAdjustment(token, adjustmentId) {
  return apiFetch(`/inventory/adjustments/${adjustmentId}/cancel`, {
    method: 'PATCH',
  }, token);
}

export function createStockReservation(token, reservationData) {
  return apiFetch('/inventory/reservations', {
    method: 'POST',
    body: JSON.stringify(reservationData),
  }, token);
}

export function listStockReservations(token, options = {}) {
  return apiFetch(`/inventory/reservations${buildQuery(options)}`, {}, token);
}

export function getStockReservation(token, reservationId) {
  return apiFetch(`/inventory/reservations/${reservationId}`, {}, token);
}

export function releaseStockReservation(token, reservationId) {
  return apiFetch(`/inventory/reservations/${reservationId}/release`, {
    method: 'PATCH',
  }, token);
}

export function consumeStockReservation(token, reservationId) {
  return apiFetch(`/inventory/reservations/${reservationId}/consume`, {
    method: 'PATCH',
  }, token);
}

export function getInventoryDashboard(token) {
  return apiFetch('/inventory/dashboard', {}, token);
}

export function listInventoryAlerts(token, options = {}) {
  return apiFetch(`/inventory/alerts${buildQuery(options)}`, {}, token);
}

export function getInventoryReports(token, options = {}) {
  return apiFetch(`/inventory/reports${buildQuery(options)}`, {}, token);
}

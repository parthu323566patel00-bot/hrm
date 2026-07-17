import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Truck, FileText, Users, Plus, RefreshCw, ClipboardList, PlusCircle, Package, Edit2, Trash2, CheckCircle, XCircle, Activity, AlertTriangle, BarChart3, FileSearch, Layers, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import BackgroundBlobs from '../components/layout/BackgroundBlobs';
import DashboardHeader from '../components/layout/DashboardHeader';
import Alert from '../components/ui/Alert';
import {
  getSuppliers, createSupplier,
  searchProductsForPO, getProducts, createProduct, updateProduct, deactivateProduct, activateProduct, deleteProduct,
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  listGoodsReceipts, createGoodsReceipt,
  listPurchaseRequisitions, getPurchaseRequisition, createPurchaseRequisition, updatePurchaseRequisition,
  approvePurchaseRequisition, rejectPurchaseRequisition, convertPurchaseRequisition,
  getCategories, createCategory,
  getUnits, createUnit,
  getManufacturers, createManufacturer,
  getBrands, createBrand,
  getStorageLocations, createStorageLocation,
  createInventoryTransfer, listInventoryTransfers, updateInventoryTransfer, approveInventoryTransfer, completeInventoryTransfer, cancelInventoryTransfer,
  createStockAdjustment, listStockAdjustments, updateStockAdjustment, approveStockAdjustment, cancelStockAdjustment,
  createStockReservation, listStockReservations, releaseStockReservation, consumeStockReservation,
  getInventoryDashboard, listInventoryAlerts, getInventoryReports,
  getInventoryStock, listInventoryLedger,
} from '../services/inventoryService';

const STATUS_LABELS = { pending: 'Pending', partially_received: 'Partially Received', completed: 'Completed', cancelled: 'Cancelled' };
const REQUISITION_STATUS_LABELS = { draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled', converted: 'Converted' };
const REQUISITION_PRIORITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TRANSFER_STATUS_LABELS = { draft: 'Draft', pending: 'Pending', approved: 'Approved', completed: 'Completed', cancelled: 'Cancelled' };
const ADJUSTMENT_STATUS_LABELS = { draft: 'Draft', pending: 'Pending', approved: 'Approved', cancelled: 'Cancelled' };
const RESERVATION_STATUS_LABELS = { active: 'Active', released: 'Released', consumed: 'Consumed', cancelled: 'Cancelled' };
const ALERT_TYPE_LABELS = { low_stock: 'Low Stock', near_expiry: 'Near Expiry', expired_stock: 'Expired Stock', dead_stock: 'Dead Stock', overstock: 'Overstock' };
const REPORT_TYPES = { inventory_stock: 'Inventory Stock', transfers: 'Transfers', adjustments: 'Stock Adjustments', reservations: 'Stock Reservations' };

function renderStatusBadge(s) {
  return <span className={`status-pill status-pill-${s}`}>{STATUS_LABELS[s] ?? s}</span>;
}

function renderRequisitionStatusBadge(s) {
  const label = REQUISITION_STATUS_LABELS[s] ?? s;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', background: s === 'draft' ? '#f1f5f9' : s === 'approved' || s === 'converted' ? '#dcfce7' : s === 'rejected' ? '#fee2e2' : s === 'pending' ? '#fef3c7' : '#e0f2fe', color: s === 'draft' ? '#475569' : s === 'approved' || s === 'converted' ? '#166534' : s === 'rejected' ? '#b91c1c' : s === 'pending' ? '#92400e' : '#0f766e', fontSize: '11px', fontWeight: 700 }}>{label}</span>;
}

function renderTransferStatusBadge(s) {
  const label = TRANSFER_STATUS_LABELS[s] ?? s;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', background: s === 'draft' ? '#f1f5f9' : s === 'approved' ? '#dcfce7' : s === 'completed' ? '#d1fae5' : s === 'cancelled' ? '#fee2e2' : '#fef3c7', color: s === 'draft' ? '#475569' : s === 'approved' ? '#166534' : s === 'completed' ? '#065f46' : s === 'cancelled' ? '#b91c1c' : '#92400e', fontSize: '11px', fontWeight: 700 }}>{label}</span>;
}

function renderAdjustmentStatusBadge(s) {
  const label = ADJUSTMENT_STATUS_LABELS[s] ?? s;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', background: s === 'draft' ? '#f1f5f9' : s === 'approved' ? '#dcfce7' : s === 'cancelled' ? '#fee2e2' : '#fef3c7', color: s === 'draft' ? '#475569' : s === 'approved' ? '#166534' : s === 'cancelled' ? '#b91c1c' : '#92400e', fontSize: '11px', fontWeight: 700 }}>{label}</span>;
}

function renderReservationStatusBadge(s) {
  const label = RESERVATION_STATUS_LABELS[s] ?? s;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', background: s === 'active' ? '#eff6ff' : s === 'released' ? '#fef3c7' : s === 'consumed' ? '#dcfce7' : '#fee2e2', color: s === 'active' ? '#1d4ed8' : s === 'released' ? '#92400e' : s === 'consumed' ? '#166534' : '#991b1b', fontSize: '11px', fontWeight: 700 }}>{label}</span>;
}

function renderAlertTypeBadge(t) {
  const label = ALERT_TYPE_LABELS[t] ?? t;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px', background: '#f8fafc', color: '#475569', fontSize: '11px', fontWeight: 700 }}>{label}</span>;
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '24px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: wide ? '1100px' : '700px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: '#ffffff', borderRadius: '20px', boxShadow: '0 24px 80px rgba(15,23,42,0.2)', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 800 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', background: '#f8fafc', cursor: 'pointer', color: '#334155', fontWeight: 700 }}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, children, span }) {
  return (
    <div className="form-group" style={{ marginBottom: 0, gridColumn: span ? '1 / -1' : undefined }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

// ── Quick-create master data inline modal ─────────────────────────────────────
function QuickCreateModal({ title, fields, onSave, onClose, loading }) {
  const [form, setForm] = useState({});
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: 'grid', gap: '14px' }}>
        {fields.map(f => (
          <FieldRow key={f.key} label={f.label}>
            <input className="form-input" type="text" value={form[f.key] || ''} onChange={set(f.key)} placeholder={f.placeholder || ''} />
          </FieldRow>
        ))}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
          <button type="button" onClick={() => onSave(form)} disabled={loading} className="submit-btn" style={{ width: 'auto', padding: '10px 20px' }}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Product Form (create / edit) ──────────────────────────────────────────────
function ProductForm({ token, initial, onSaved, onClose }) {
  const empty = { product_code: '', name: '', generic_name: '', description: '', category_id: '', brand_id: '', manufacturer_id: '', unit_id: '', default_supplier_id: '', storage_location_id: '', minimum_stock: '0', maximum_stock: '0', reorder_level: '0', hsn_code: '', gst_percent: '0', status: 'active' };
  const [form, setForm] = useState(initial ? { ...empty, ...initial, category_id: initial.category_id || '', brand_id: initial.brand_id || '', manufacturer_id: initial.manufacturer_id || '', unit_id: initial.unit_id || '', default_supplier_id: initial.default_supplier_id || '', storage_location_id: initial.storage_location_id || '' } : empty);
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [mfrs, setMfrs] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [quickCreate, setQuickCreate] = useState(null); // { type, fields }

  useEffect(() => {
    Promise.all([
      getCategories(token), getBrands(token), getManufacturers(token),
      getUnits(token), getSuppliers(token), getStorageLocations(token),
    ]).then(([c, b, m, u, s, l]) => {
      setCats(c || []); setBrands(b || []); setMfrs(m || []);
      setUnits(u || []); setSuppliers(s || []); setLocations(l || []);
    }).catch(() => {});
  }, [token]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setErr('');
    if (!form.product_code.trim()) return setErr('Product code is required.');
    if (!form.name.trim()) return setErr('Product name is required.');
    if (!form.category_id) return setErr('Category is required.');
    if (!form.brand_id) return setErr('Brand is required.');
    if (!form.manufacturer_id) return setErr('Manufacturer is required.');
    if (!form.unit_id) return setErr('Unit is required.');
    if (!form.default_supplier_id) return setErr('Supplier is required.');
    if (!form.storage_location_id) return setErr('Storage location is required.');
    setSaving(true);
    try {
      const payload = { ...form, minimum_stock: Number(form.minimum_stock || 0), maximum_stock: Number(form.maximum_stock || 0), reorder_level: Number(form.reorder_level || 0), gst_percent: Number(form.gst_percent || 0), category_id: Number(form.category_id), brand_id: Number(form.brand_id), manufacturer_id: Number(form.manufacturer_id), unit_id: Number(form.unit_id), default_supplier_id: Number(form.default_supplier_id), storage_location_id: Number(form.storage_location_id) };
      if (initial?.id) { await updateProduct(token, initial.id, payload); } else { await createProduct(token, payload); }
      onSaved();
    } catch (e) { setErr(e.message || 'Failed to save product.'); }
    finally { setSaving(false); }
  };

  const handleQuickSave = async (data) => {
    if (!quickCreate) return;
    setSaving(true);
    try {
      let created;
      if (quickCreate.type === 'category') { created = await createCategory(token, { name: data.name, status: 'active' }); setCats(p => [...p, created]); setForm(f => ({ ...f, category_id: created.id })); }
      else if (quickCreate.type === 'brand') { created = await createBrand(token, { name: data.name, manufacturer_id: Number(form.manufacturer_id) || 1, status: 'active' }); setBrands(p => [...p, created]); setForm(f => ({ ...f, brand_id: created.id })); }
      else if (quickCreate.type === 'manufacturer') { created = await createManufacturer(token, { name: data.name, status: 'active' }); setMfrs(p => [...p, created]); setForm(f => ({ ...f, manufacturer_id: created.id })); }
      else if (quickCreate.type === 'unit') { created = await createUnit(token, { name: data.name, status: 'active' }); setUnits(p => [...p, created]); setForm(f => ({ ...f, unit_id: created.id })); }
      else if (quickCreate.type === 'location') { created = await createStorageLocation(token, { name: data.name, status: 'active' }); setLocations(p => [...p, created]); setForm(f => ({ ...f, storage_location_id: created.id })); }
      setQuickCreate(null);
    } catch (e) { setErr(e.message || 'Quick create failed.'); }
    finally { setSaving(false); }
  };

  const sel = (key, items, label, qcType) => (
    <FieldRow label={label}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <select className="form-input" value={form[key]} onChange={set(key)} style={{ flex: 1 }}>
          <option value="">Select {label.toLowerCase()}</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        {qcType && <button type="button" title={`New ${label}`} onClick={() => setQuickCreate({ type: qcType, fields: [{ key: 'name', label: 'Name' }] })} style={{ padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f0fdf4', cursor: 'pointer', color: '#16a34a', fontWeight: 700, fontSize: '18px' }}>+</button>}
      </div>
    </FieldRow>
  );

  return (
    <>
      {quickCreate && <QuickCreateModal title={`New ${quickCreate.type}`} fields={quickCreate.fields} onSave={handleQuickSave} onClose={() => setQuickCreate(null)} loading={saving} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {err && <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>{err}</div>}
        <FieldRow label="Product Code *"><input className="form-input" value={form.product_code} onChange={set('product_code')} disabled={!!initial?.id} /></FieldRow>
        <FieldRow label="Product Name *"><input className="form-input" value={form.name} onChange={set('name')} /></FieldRow>
        <FieldRow label="Generic Name"><input className="form-input" value={form.generic_name} onChange={set('generic_name')} /></FieldRow>
        <FieldRow label="HSN/SAC Code"><input className="form-input" value={form.hsn_code} onChange={set('hsn_code')} /></FieldRow>
        {sel('category_id', cats, 'Category', 'category')}
        {sel('brand_id', brands, 'Brand', 'brand')}
        {sel('manufacturer_id', mfrs, 'Manufacturer', 'manufacturer')}
        {sel('unit_id', units, 'Unit of Measure', 'unit')}
        {sel('default_supplier_id', suppliers, 'Default Supplier', null)}
        {sel('storage_location_id', locations, 'Storage Location', 'location')}
        <FieldRow label="Min Stock"><input type="number" min="0" className="form-input" value={form.minimum_stock} onChange={set('minimum_stock')} /></FieldRow>
        <FieldRow label="Max Stock"><input type="number" min="0" className="form-input" value={form.maximum_stock} onChange={set('maximum_stock')} /></FieldRow>
        <FieldRow label="Reorder Level"><input type="number" min="0" className="form-input" value={form.reorder_level} onChange={set('reorder_level')} /></FieldRow>
        <FieldRow label="GST %"><input type="number" min="0" step="0.01" className="form-input" value={form.gst_percent} onChange={set('gst_percent')} /></FieldRow>
        <FieldRow label="Status">
          <select className="form-input" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FieldRow>
        <FieldRow label="Description" span><textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={form.description} onChange={set('description')} /></FieldRow>
        <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }}>{saving ? 'Saving…' : initial?.id ? 'Update Product' : 'Create Product'}</button>
        </div>
      </div>
    </>
  );
}

function RequisitionForm({ token, initial, onSaved, onClose, searchProducts, productSearchResults, setErrorMsg }) {
  const emptyItem = { product_id: '', requested_quantity: '', estimated_unit_price: '', remarks: '' };
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(initial ? {
    required_date: initial.required_date ? String(initial.required_date).slice(0, 10) : '',
    priority: initial.priority || 'normal',
    remarks: initial.remarks || '',
    supplier_id: initial.supplier_id ?? '',
    items: (initial.items ?? []).map(item => ({ product_id: item.product_id ? String(item.product_id) : '', requested_quantity: item.requested_quantity != null ? String(item.requested_quantity) : '', estimated_unit_price: item.estimated_unit_price != null ? String(item.estimated_unit_price) : '', remarks: item.remarks || '' }))
  } : { required_date: '', priority: 'normal', remarks: '', supplier_id: '', items: [ { ...emptyItem } ] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    if (!token) return;
    const q = productQuery.trim();
    if (q.length >= 2) searchProducts(q);
    else searchProducts('');
  }, [productQuery, searchProducts, token]);

  useEffect(() => {
    if (!token) return;
    import('../services/inventoryService').then(({ getSuppliers }) => getSuppliers(token)).then(setSuppliers).catch(() => setSuppliers([]));
  }, [token]);

  const setField = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const updateItem = (index, field, value) => setForm(f => {
    const items = [...f.items];
    items[index] = { ...items[index], [field]: value };
    return { ...f, items };
  });
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (index) => setForm(f => {
    const items = [...f.items];
    items.splice(index, 1);
    return { ...f, items: items.length ? items : [{ ...emptyItem }] };
  });

  const handleSave = async () => {
    setErr('');
    if (!form.items.length || form.items.every(item => !item.product_id)) {
      setErr('Add at least one requisition item.');
      return;
    }
    const seenProducts = new Set();
    for (const item of form.items) {
      if (!item.product_id) { setErr('Each requisition item needs a product.'); return; }
      const productKey = String(item.product_id);
      if (seenProducts.has(productKey)) { setErr('Duplicate products are not allowed in one requisition.'); return; }
      seenProducts.add(productKey);
      const qty = Number(item.requested_quantity || 0);
      const price = Number(item.estimated_unit_price || 0);
      if (!Number.isFinite(qty) || qty <= 0) { setErr('Quantity must be greater than zero.'); return; }
      if (!Number.isFinite(price) || price < 0) { setErr('Estimated unit price must be zero or positive.'); return; }
    }

    setSaving(true);
    try {
      const payload = {
        requested_date: today,
        required_date: form.required_date || undefined,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        priority: form.priority || 'normal',
        remarks: form.remarks || undefined,
        items: form.items.map(item => ({
          product_id: Number(item.product_id),
          requested_quantity: Number(item.requested_quantity),
          estimated_unit_price: Number(item.estimated_unit_price || 0),
          remarks: item.remarks || undefined,
        })),
      };
      if (initial?.id) {
        await updatePurchaseRequisition(token, initial.id, payload);
      } else {
        await createPurchaseRequisition(token, payload);
      }
      onSaved();
    } catch (e) {
      setErr(e.message || 'Unable to save requisition.');
      setErrorMsg(e.message || 'Unable to save requisition.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {err && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <FieldRow label="Required Date"><input type="date" className="form-input" value={form.required_date} onChange={setField('required_date')} /></FieldRow>
        <FieldRow label="Priority">
          <select className="form-input" value={form.priority} onChange={setField('priority')}>
            {Object.entries(REQUISITION_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Supplier"><select className="form-input" value={form.supplier_id} onChange={setField('supplier_id')}>
          <option value="">Select supplier (optional)</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></FieldRow>
        <FieldRow label="Remarks" span><input className="form-input" value={form.remarks} onChange={setField('remarks')} placeholder="Optional remarks" /></FieldRow>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Requisition Items</h3>
          <button type="button" onClick={addItem} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}><PlusCircle size={15} /> Add item</button>
        </div>
        <FieldRow label="Product Search"><input className="form-input" value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder="Type product name or code" /></FieldRow>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}>{['Product', 'Qty', 'Unit Price', 'Estimated Total', 'Remarks', ''].map(label => <th key={label} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '11px' }}>{label}</th>)}</tr></thead>
            <tbody>
              {form.items.map((item, index) => {
                const total = Number(item.requested_quantity || 0) * Number(item.estimated_unit_price || 0);
                return (
                  <tr key={`${index}-${item.product_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', minWidth: '220px' }}>
                      <select className="form-input" value={item.product_id} onChange={e => updateItem(index, 'product_id', e.target.value)}>
                        <option value="">Select product</option>
                        {productSearchResults.map(product => <option key={product.id} value={product.id}>{product.name}{product.product_code ? ` (${product.product_code})` : ''}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px', minWidth: '90px' }}><input type="number" min="0" step="1" className="form-input" value={item.requested_quantity} onChange={e => updateItem(index, 'requested_quantity', e.target.value)} /></td>
                    <td style={{ padding: '8px 10px', minWidth: '105px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.estimated_unit_price} onChange={e => updateItem(index, 'estimated_unit_price', e.target.value)} /></td>
                    <td style={{ padding: '8px 10px', minWidth: '115px', fontWeight: 700 }}>₹{total.toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', minWidth: '150px' }}><input className="form-input" value={item.remarks} onChange={e => updateItem(index, 'remarks', e.target.value)} /></td>
                    <td style={{ padding: '8px 10px' }}><button type="button" onClick={() => removeItem(index)} style={{ border: 'none', background: '#fef2f2', color: '#b91c1c', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving} className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }}>{saving ? 'Saving…' : initial?.id ? 'Update Requisition' : 'Create Requisition'}</button>
      </div>
    </div>
  );
}

// ── Products tab ──────────────────────────────────────────────────────────────
function ProductsTab({ token }) {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await getProducts(token, search, 1, 50);
      let data = r?.data ?? r ?? [];
      if (statusFilter) data = data.filter(p => p.status === statusFilter);
      setProducts(data); setMeta(r?.meta ?? null);
    } catch (e) { setErr(e.message || 'Failed to load products.'); }
    finally { setLoading(false); }
  }, [token, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (p) => {
    setErr(''); setSuccess('');
    try {
      if (p.status === 'active') { await deactivateProduct(token, p.id); setSuccess(`"${p.name}" deactivated.`); }
      else { await activateProduct(token, p.id); setSuccess(`"${p.name}" activated.`); }
      load();
    } catch (e) { setErr(e.message || 'Action failed.'); }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Soft-delete "${p.name}"? This cannot be reversed if stock exists.`)) return;
    setErr(''); setSuccess('');
    try { await deleteProduct(token, p.id); setSuccess(`"${p.name}" deleted.`); load(); }
    catch (e) { setErr(e.message || 'Delete failed.'); }
  };

  return (
    <div>
      {showForm && (
        <Modal title={editing ? 'Edit Product' : 'New Product'} onClose={() => { setShowForm(false); setEditing(null); }} wide>
          <ProductForm token={token} initial={editing} onSaved={() => { setShowForm(false); setEditing(null); setSuccess('Product saved.'); load(); }} onClose={() => { setShowForm(false); setEditing(null); }} />
        </Modal>
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px' }}>
          <label className="form-label">Search</label>
          <input className="form-input" type="search" placeholder="Name, code, generic…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Status</label>
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button type="button" className="submit-btn" style={{ width: 'auto', padding: '10px 18px', alignSelf: 'flex-end' }} onClick={() => { setShowForm(true); setEditing(null); }}><Plus size={15} /> New Product</button>
        <button type="button" onClick={load} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', padding: '10px 14px', cursor: 'pointer', alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}><RefreshCw size={13} /> Refresh</button>
      </div>
      <Alert type="error" message={err} />
      <Alert type="success" message={success} />
      <div style={{ overflowX: 'auto' }}>
        <table className="inventory-table">
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {['Code', 'Name', 'Generic', 'Category', 'Brand', 'Unit', 'GST%', 'Min/Max/Reorder', 'Status', 'Actions'].map(l => (
                <th key={l} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading products…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No products found. Create your first product to start purchasing.</td></tr>
            ) : products.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: '#334155' }}>{p.product_code}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>{p.generic_name || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px' }}>{p.category_name || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px' }}>{p.brand_name || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px' }}>{p.unit_name || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px' }}>{p.gst_percent}%</td>
                <td style={{ padding: '10px 12px', fontSize: '11px', color: '#64748b' }}>{p.minimum_stock}/{p.maximum_stock}/{p.reorder_level}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: p.status === 'active' ? '#d1fae5' : '#f1f5f9', color: p.status === 'active' ? '#065f46' : '#64748b' }}>{p.status}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" title="Edit" onClick={() => { setEditing(p); setShowForm(true); }} style={{ border: 'none', background: '#eff6ff', color: '#2563eb', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer' }}><Edit2 size={12} /></button>
                    <button type="button" title={p.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => handleToggle(p)} style={{ border: 'none', background: p.status === 'active' ? '#fef3c7' : '#d1fae5', color: p.status === 'active' ? '#92400e' : '#065f46', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer' }}>
                      {p.status === 'active' ? <XCircle size={12} /> : <CheckCircle size={12} />}
                    </button>
                    <button type="button" title="Delete" onClick={() => handleDelete(p)} style={{ border: 'none', background: '#fef2f2', color: '#b91c1c', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer' }}><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main InventoryPage ────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { userProfile, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('purchase_orders');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrdersMeta, setPurchaseOrdersMeta] = useState(null);
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState('');
  const [purchaseOrderSupplierFilter, setPurchaseOrderSupplierFilter] = useState('');
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState('');

  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [goodsReceiptsMeta, setGoodsReceiptsMeta] = useState(null);
  const [goodsReceiptSearch, setGoodsReceiptSearch] = useState('');

  const [requisitions, setRequisitions] = useState([]);
  const [requisitionsMeta, setRequisitionsMeta] = useState(null);
  const [requisitionSearch, setRequisitionSearch] = useState('');
  const [requisitionStatusFilter, setRequisitionStatusFilter] = useState('');
  const [requisitionPriorityFilter, setRequisitionPriorityFilter] = useState('');
  const [requisitionDateFilter, setRequisitionDateFilter] = useState('');
  const [requisitionRequestedByFilter, setRequisitionRequestedByFilter] = useState('');

  const [transfers, setTransfers] = useState([]);
  const [transferMeta, setTransferMeta] = useState(null);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState('');
  const [transferFromLocationFilter, setTransferFromLocationFilter] = useState('');
  const [transferToLocationFilter, setTransferToLocationFilter] = useState('');

  const [adjustments, setAdjustments] = useState([]);
  const [adjustmentsMeta, setAdjustmentsMeta] = useState(null);
  const [adjustmentSearch, setAdjustmentSearch] = useState('');
  const [adjustmentStatusFilter, setAdjustmentStatusFilter] = useState('');

  const [reservations, setReservations] = useState([]);
  const [reservationsMeta, setReservationsMeta] = useState(null);
  const [reservationSearch, setReservationSearch] = useState('');
  const [reservationStatusFilter, setReservationStatusFilter] = useState('');
  const [reservationProductFilter, setReservationProductFilter] = useState('');
  const [reservationPatientFilter, setReservationPatientFilter] = useState('');
  const [reservationDepartmentFilter, setReservationDepartmentFilter] = useState('');

  const [stockItems, setStockItems] = useState([]);
  const [stockMeta, setStockMeta] = useState(null);
  const [stockSearch, setStockSearch] = useState('');
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerMeta, setLedgerMeta] = useState(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTransactionFilter, setLedgerTransactionFilter] = useState('');

  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [alertReasonFilter, setAlertReasonFilter] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [reportType, setReportType] = useState('inventory_stock');
  const [reports, setReports] = useState([]);
  const [reportsMeta, setReportsMeta] = useState(null);

  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);

  const [showPoModal, setShowPoModal] = useState(false);
  const [showGrModal, setShowGrModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [showRequisitionDetailModal, setShowRequisitionDetailModal] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState(null);
  const [selectedRequisition, setSelectedRequisition] = useState(null);

  const [poForm, setPoForm] = useState({
    supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    remarks: 'N/A',
    items: [{ product_id: '', quantity: '', expected_unit_price: '', tax_percent: '0', discount_percent: '0' }],
  });

  const [receiptForm, setReceiptForm] = useState({ purchase_order_id: '', received_date: new Date().toISOString().slice(0, 10), remarks: '' });
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);

  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', company_name: '', email: '', address: '', city: '', state: '', country: '', postal_code: '', contact_person: '', status: 'active', remarks: '' });
  const [locations, setLocations] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_location_id: '', to_location_id: '', remarks: '', items: [{ product_id: '', quantity: '', remarks: '' }] });
  const [adjustmentForm, setAdjustmentForm] = useState({ reason: '', remarks: '', items: [{ product_id: '', quantity: '', unit_cost: '', remarks: '' }] });
  const [reservationForm, setReservationForm] = useState({ patient_id: '', department_id: '', product_id: '', batch_number: '', quantity: '', expiry_datetime: '', remarks: '' });

  // Load product search for PO dropdown
  const searchProducts = useCallback(async (q) => {
    try {
      const res = await searchProductsForPO(token, q);
      setProductSearchResults(res ?? []);
    } catch { setProductSearchResults([]); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (['purchase_orders', 'suppliers', 'requisitions', 'transfers', 'adjustments', 'reservations'].includes(activeTab)) {
      loadSuppliers();
      loadStorageLocations();
      searchProducts('');
    }
    if (activeTab === 'purchase_orders') { loadPurchaseOrders(); }
    if (activeTab === 'goods_receipts') loadGoodsReceipts();
    if (activeTab === 'requisitions') loadPurchaseRequisitions();
    if (activeTab === 'transfers') loadInventoryTransfers();
    if (activeTab === 'adjustments') loadStockAdjustments();
    if (activeTab === 'reservations') loadStockReservations();
    if (activeTab === 'stock') loadInventoryStock();
    if (activeTab === 'ledger') loadInventoryLedger();
    if (activeTab === 'dashboard') loadInventoryDashboard();
    if (activeTab === 'alerts') loadInventoryAlerts();
    if (activeTab === 'reports') loadInventoryReports();
  }, [activeTab, token, purchaseOrderSearch, goodsReceiptSearch, supplierSearch, purchaseOrderSupplierFilter, purchaseOrderStatusFilter, requisitionSearch, requisitionStatusFilter, requisitionPriorityFilter, requisitionDateFilter, requisitionRequestedByFilter, transferSearch, transferStatusFilter, transferFromLocationFilter, transferToLocationFilter, adjustmentSearch, adjustmentStatusFilter, reservationSearch, reservationStatusFilter, reservationProductFilter, reservationPatientFilter, reservationDepartmentFilter, stockSearch, ledgerSearch, ledgerTransactionFilter, alertReasonFilter, reportType]);

  useEffect(() => {
    if (!token || !receiptForm.purchase_order_id) return;
    loadPurchaseOrderDetails(receiptForm.purchase_order_id);
  }, [receiptForm.purchase_order_id, token]);

  const loadSuppliers = async () => {
    try { const d = await getSuppliers(token, supplierSearch); setSuppliers(d ?? []); }
    catch (e) { setErrorMsg(e.message || 'Unable to load suppliers.'); }
  };

  const loadPurchaseOrders = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const r = await listPurchaseOrders(token, { q: purchaseOrderSearch, supplier_id: purchaseOrderSupplierFilter, status: purchaseOrderStatusFilter, page: 1, page_size: 50 });
      setPurchaseOrders(r?.data ?? []); setPurchaseOrdersMeta(r?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load purchase orders.'); setPurchaseOrders([]); }
    finally { setLoading(false); }
  };

  const loadGoodsReceipts = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const r = await listGoodsReceipts(token, { q: goodsReceiptSearch, page: 1, page_size: 50 });
      setGoodsReceipts(r?.data ?? []); setGoodsReceiptsMeta(r?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load goods receipts.'); setGoodsReceipts([]); }
    finally { setLoading(false); }
  };

  const loadPurchaseRequisitions = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const r = await listPurchaseRequisitions(token, {
        q: requisitionSearch,
        status: requisitionStatusFilter || undefined,
        priority: requisitionPriorityFilter || undefined,
        requested_by: requisitionRequestedByFilter ? Number(requisitionRequestedByFilter) : undefined,
        from_date: requisitionDateFilter || undefined,
        to_date: requisitionDateFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setRequisitions(r?.data ?? []); setRequisitionsMeta(r?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load purchase requisitions.'); setRequisitions([]); }
    finally { setLoading(false); }
  };

  const loadInventoryTransfers = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const r = await listInventoryTransfers(token, {
        q: transferSearch,
        status: transferStatusFilter || undefined,
        from_location_id: transferFromLocationFilter ? Number(transferFromLocationFilter) : undefined,
        to_location_id: transferToLocationFilter ? Number(transferToLocationFilter) : undefined,
        page: 1,
        page_size: 50,
      });
      setTransfers(r?.data ?? []); setTransferMeta(r?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load inventory transfers.'); setTransfers([]); }
    finally { setLoading(false); }
  };

  const loadStockAdjustments = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const r = await listStockAdjustments(token, {
        q: adjustmentSearch,
        status: adjustmentStatusFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setAdjustments(r?.data ?? []); setAdjustmentsMeta(r?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load stock adjustments.'); setAdjustments([]); }
    finally { setLoading(false); }
  };

  const loadStockReservations = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const r = await listStockReservations(token, {
        q: reservationSearch,
        status: reservationStatusFilter || undefined,
        product_id: reservationProductFilter ? Number(reservationProductFilter) : undefined,
        patient_id: reservationPatientFilter ? Number(reservationPatientFilter) : undefined,
        department_id: reservationDepartmentFilter ? Number(reservationDepartmentFilter) : undefined,
        page: 1,
        page_size: 50,
      });
      setReservations(r?.data ?? []); setReservationsMeta(r?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load stock reservations.'); setReservations([]); }
    finally { setLoading(false); }
  };

  const loadInventoryDashboard = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const result = await getInventoryDashboard(token);
      setDashboardMetrics(result || null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load inventory dashboard.'); setDashboardMetrics(null); }
    finally { setLoading(false); }
  };

  const loadInventoryAlerts = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const alertsList = await listInventoryAlerts(token, { reason: alertReasonFilter || undefined });
      setAlerts(alertsList || []);
    } catch (e) { setErrorMsg(e.message || 'Unable to load inventory alerts.'); setAlerts([]); }
    finally { setLoading(false); }
  };

  const loadInventoryReports = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const result = await getInventoryReports(token, { report_type: reportType, page: 1, page_size: 50 });
      setReports(result?.data ?? []);
      setReportsMeta(result?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load inventory reports.'); setReports([]); }
    finally { setLoading(false); }
  };

  const loadInventoryStock = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const result = await getInventoryStock(token, { q: stockSearch, page: 1, page_size: 50 });
      setStockItems(result?.data ?? []);
      setStockMeta(result?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load inventory stock.'); setStockItems([]); }
    finally { setLoading(false); }
  };

  const loadInventoryLedger = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const result = await listInventoryLedger(token, { q: ledgerSearch, transaction_type: ledgerTransactionFilter || undefined, page: 1, page_size: 50 });
      setLedgerEntries(result?.data ?? []);
      setLedgerMeta(result?.meta ?? null);
    } catch (e) { setErrorMsg(e.message || 'Unable to load inventory ledger.'); setLedgerEntries([]); }
    finally { setLoading(false); }
  };

  const loadStorageLocations = async () => {
    try {
      const locs = await getStorageLocations(token);
      setLocations(locs ?? []);
    } catch { setLocations([]); }
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!transferForm.from_location_id || !transferForm.to_location_id) { setErrorMsg('Please select both source and destination locations.'); return; }
    if (transferForm.from_location_id === transferForm.to_location_id) { setErrorMsg('Source and destination cannot be the same.'); return; }
    const invalidItems = transferForm.items.filter(item => !item.product_id || !item.quantity);
    if (invalidItems.length) { setErrorMsg('All transfer items require a product and quantity.'); return; }
    setLoading(true); setErrorMsg('');
    try {
      await createInventoryTransfer(token, {
        from_location_id: Number(transferForm.from_location_id),
        to_location_id: Number(transferForm.to_location_id),
        remarks: transferForm.remarks || undefined,
        items: transferForm.items.map(item => ({ product_id: Number(item.product_id), quantity: Number(item.quantity), remarks: item.remarks || undefined })),
      });
      setShowTransferModal(false);
      setSuccessMsg('Inventory transfer created.');
      setTransferForm({ from_location_id: '', to_location_id: '', remarks: '', items: [{ product_id: '', quantity: '', remarks: '' }] });
      loadInventoryTransfers();
    } catch (e) { setErrorMsg(e.message || 'Unable to create inventory transfer.'); }
    finally { setLoading(false); }
  };

  const handleCreateAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustmentForm.reason.trim()) { setErrorMsg('Adjustment reason is required.'); return; }
    const invalidItems = adjustmentForm.items.filter(item => !item.product_id || !item.quantity);
    if (invalidItems.length) { setErrorMsg('All adjustment items require a product and quantity.'); return; }
    setLoading(true); setErrorMsg('');
    try {
      await createStockAdjustment(token, {
        reason: adjustmentForm.reason,
        remarks: adjustmentForm.remarks || undefined,
        items: adjustmentForm.items.map(item => ({ product_id: Number(item.product_id), quantity: Number(item.quantity), unit_cost: item.unit_cost ? Number(item.unit_cost) : undefined, remarks: item.remarks || undefined })),
      });
      setShowAdjustmentModal(false);
      setSuccessMsg('Stock adjustment created.');
      setAdjustmentForm({ reason: '', remarks: '', items: [{ product_id: '', quantity: '', unit_cost: '', remarks: '' }] });
      loadStockAdjustments();
    } catch (e) { setErrorMsg(e.message || 'Unable to create stock adjustment.'); }
    finally { setLoading(false); }
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!reservationForm.product_id || !reservationForm.quantity) { setErrorMsg('Product and quantity are required.'); return; }
    setLoading(true); setErrorMsg('');
    try {
      await createStockReservation(token, {
        patient_id: reservationForm.patient_id ? Number(reservationForm.patient_id) : undefined,
        department_id: reservationForm.department_id ? Number(reservationForm.department_id) : undefined,
        product_id: Number(reservationForm.product_id),
        batch_number: reservationForm.batch_number || undefined,
        quantity: Number(reservationForm.quantity),
        expiry_datetime: reservationForm.expiry_datetime || undefined,
        remarks: reservationForm.remarks || undefined,
      });
      setShowReservationModal(false);
      setSuccessMsg('Stock reservation created.');
      setReservationForm({ patient_id: '', department_id: '', product_id: '', batch_number: '', quantity: '', expiry_datetime: '', remarks: '' });
      loadStockReservations();
    } catch (e) { setErrorMsg(e.message || 'Unable to create stock reservation.'); }
    finally { setLoading(false); }
  };

  const handleTransferAction = async (transfer, action) => {
    setErrorMsg(''); setSuccessMsg('');
    try {
      if (action === 'approve') await approveInventoryTransfer(token, transfer.id);
      else if (action === 'complete') await completeInventoryTransfer(token, transfer.id);
      else if (action === 'cancel') await cancelInventoryTransfer(token, transfer.id);
      setSuccessMsg(`Transfer ${action}d.`);
      loadInventoryTransfers();
    } catch (e) { setErrorMsg(e.message || `Unable to ${action} transfer.`); }
  };

  const handleAdjustmentAction = async (adjustment, action) => {
    setErrorMsg(''); setSuccessMsg('');
    try {
      if (action === 'approve') await approveStockAdjustment(token, adjustment.id);
      else if (action === 'cancel') await cancelStockAdjustment(token, adjustment.id);
      setSuccessMsg(`Adjustment ${action}d.`);
      loadStockAdjustments();
    } catch (e) { setErrorMsg(e.message || `Unable to ${action} adjustment.`); }
  };

  const handleReservationAction = async (reservation, action) => {
    setErrorMsg(''); setSuccessMsg('');
    try {
      if (action === 'release') await releaseStockReservation(token, reservation.id);
      else if (action === 'consume') await consumeStockReservation(token, reservation.id);
      setSuccessMsg(`Reservation ${action}d.`);
      loadStockReservations();
    } catch (e) { setErrorMsg(e.message || `Unable to ${action} reservation.`); }
  };

  const loadPurchaseOrderDetails = async (id) => {
    setLoading(true); setErrorMsg('');
    try {
      const order = await getPurchaseOrder(token, id);
      setReceiptOrder(order);
      const items = (order.items ?? []).map(item => ({
        purchase_order_item_id: item.id, product_id: item.product_id,
        product_name: item.product_name,
        remaining_quantity: Math.max(0, item.quantity - item.received_quantity),
        received_quantity: String(Math.max(0, item.quantity - item.received_quantity)),
        unit_cost: String(item.expected_unit_price ?? 0),
        batch_number: `BATCH-${item.id}`,
        manufacturing_date: new Date().toISOString().slice(0, 10),
        expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
        tax_percent: String(item.tax_percent ?? 0),
        discount_percent: String(item.discount_percent ?? 0),
      })).filter(i => i.remaining_quantity > 0);
      setReceiptItems(items);
    } catch (e) { setErrorMsg(e.message || 'Unable to load PO details.'); setReceiptOrder(null); setReceiptItems([]); }
    finally { setLoading(false); }
  };

  const handleProductSelect = (index, productId) => {
    const prod = productSearchResults.find(p => String(p.id) === String(productId));
    setPoForm(cur => {
      const items = [...cur.items];
      items[index] = { ...items[index], product_id: productId, tax_percent: prod ? String(prod.gst_percent) : items[index].tax_percent };
      return { ...cur, items };
    });
  };

  const handleAddPOItem = () => setPoForm(c => ({ ...c, items: [...c.items, { product_id: '', quantity: '', expected_unit_price: '', tax_percent: '0', discount_percent: '0' }] }));
  const handleUpdatePOItem = (i, f, v) => setPoForm(c => { const items = [...c.items]; items[i] = { ...items[i], [f]: v }; return { ...c, items }; });
  const handleRemovePOItem = (i) => setPoForm(c => { const items = [...c.items]; items.splice(i, 1); return { ...c, items: items.length ? items : [{ product_id: '', quantity: '', expected_unit_price: '', tax_percent: '0', discount_percent: '0' }] }; });

  const handleAddTransferItem = () => setTransferForm(c => ({ ...c, items: [...c.items, { product_id: '', quantity: '', remarks: '' }] }));
  const handleUpdateTransferItem = (index, field, value) => setTransferForm(c => { const items = [...c.items]; items[index] = { ...items[index], [field]: value }; return { ...c, items }; });
  const handleRemoveTransferItem = (index) => setTransferForm(c => { const items = [...c.items]; items.splice(index, 1); return { ...c, items: items.length ? items : [{ product_id: '', quantity: '', remarks: '' }] }; });

  const handleAddAdjustmentItem = () => setAdjustmentForm(c => ({ ...c, items: [...c.items, { product_id: '', quantity: '', unit_cost: '', remarks: '' }] }));
  const handleUpdateAdjustmentItem = (index, field, value) => setAdjustmentForm(c => { const items = [...c.items]; items[index] = { ...items[index], [field]: value }; return { ...c, items }; });
  const handleRemoveAdjustmentItem = (index) => setAdjustmentForm(c => { const items = [...c.items]; items.splice(index, 1); return { ...c, items: items.length ? items : [{ product_id: '', quantity: '', unit_cost: '', remarks: '' }] }; });

  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (!poForm.supplier_id) { setErrorMsg('Please select a supplier.'); return; }
    const invalidItems = poForm.items.filter(it => !it.product_id || !it.quantity || !it.expected_unit_price);
    if (invalidItems.length) { setErrorMsg('All items need a product, quantity and unit price.'); return; }
    setLoading(true); setErrorMsg('');
    try {
      await createPurchaseOrder(token, {
        supplier_id: Number(poForm.supplier_id),
        purchase_date: poForm.purchase_date || undefined,
        expected_delivery_date: poForm.expected_delivery_date || undefined,
        remarks: poForm.remarks || undefined,
        items: poForm.items.map(it => ({ product_id: Number(it.product_id), quantity: Number(it.quantity), expected_unit_price: Number(it.expected_unit_price), tax_percent: Number(it.tax_percent || 0), discount_percent: Number(it.discount_percent || 0) })),
      });
      setShowPoModal(false);
      setSuccessMsg('Purchase order created.');
      setPoForm({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), expected_delivery_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), remarks: 'N/A', items: [{ product_id: '', quantity: '', expected_unit_price: '', tax_percent: '0', discount_percent: '0' }] });
      loadPurchaseOrders();
    } catch (e) { setErrorMsg(e.message || 'Unable to create purchase order.'); }
    finally { setLoading(false); }
  };

  const handleCreateGR = async (e) => {
    e.preventDefault();
    if (!receiptForm.purchase_order_id) { setErrorMsg('Please select a purchase order.'); return; }
    setLoading(true); setErrorMsg('');
    try {
      await createGoodsReceipt(token, {
        purchase_order_id: Number(receiptForm.purchase_order_id),
        received_date: receiptForm.received_date || undefined,
        remarks: receiptForm.remarks || undefined,
        items: receiptItems.map(it => ({ purchase_order_item_id: Number(it.purchase_order_item_id), product_id: Number(it.product_id), received_quantity: Number(it.received_quantity), unit_cost: Number(it.unit_cost), batch_number: it.batch_number, manufacturing_date: it.manufacturing_date, expiry_date: it.expiry_date, tax_percent: Number(it.tax_percent || 0), discount_percent: Number(it.discount_percent || 0) })),
      });
      setShowGrModal(false); setSuccessMsg('Goods receipt created.');
      setReceiptForm({ purchase_order_id: '', received_date: new Date().toISOString().slice(0, 10), remarks: '' });
      setReceiptOrder(null); setReceiptItems([]);
      loadGoodsReceipts(); loadPurchaseOrders();
    } catch (e) { setErrorMsg(e.message || 'Unable to create goods receipt.'); }
    finally { setLoading(false); }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    setLoading(true); setErrorMsg('');
    try {
      await createSupplier(token, supplierForm);
      setShowSupplierModal(false); setSuccessMsg('Supplier created.');
      setSupplierForm({ name: '', phone: '', company_name: '', email: '', address: '', city: '', state: '', country: '', postal_code: '', contact_person: '', status: 'active', remarks: '' });
      loadSuppliers();
    } catch (e) { setErrorMsg(e.message || 'Unable to create supplier.'); }
    finally { setLoading(false); }
  };

  const handleRequisitionAction = async (requisition, action) => {
    setErrorMsg(''); setSuccessMsg('');
    try {
      if (action === 'submit') {
        await approvePurchaseRequisition(token, requisition.id, { remarks: 'Submitted for approval' });
        setSuccessMsg('Requisition submitted.');
      } else if (action === 'approve') {
        await approvePurchaseRequisition(token, requisition.id, { remarks: 'Approved' });
        setSuccessMsg('Requisition approved.');
      } else if (action === 'reject') {
        const reason = window.prompt('Rejection reason');
        if (!reason) return;
        await rejectPurchaseRequisition(token, requisition.id, { remarks: reason });
        setSuccessMsg('Requisition rejected.');
      } else if (action === 'convert') {
        if (!requisition.supplier_id) {
          setErrorMsg('Select a supplier before converting the requisition.');
          return;
        }
        await convertPurchaseRequisition(token, requisition.id, { supplier_id: Number(requisition.supplier_id), remarks: 'Converted to purchase order' });
        setSuccessMsg('Requisition converted to purchase order.');
      }
      loadPurchaseRequisitions();
    } catch (e) {
      setErrorMsg(e.message || 'Unable to complete requisition action.');
    }
  };

  const openRequisitionDetails = async (requisition) => {
    setErrorMsg('');
    try {
      const detail = await getPurchaseRequisition(token, requisition.id);
      setSelectedRequisition(detail);
      setShowRequisitionDetailModal(true);
    } catch (e) {
      setErrorMsg(e.message || 'Unable to load requisition details.');
    }
  };

  const purchaseOrderTotals = useMemo(() => ({
    totalAmount: purchaseOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
    pending: purchaseOrders.filter(o => o.status === 'pending').length,
    partial: purchaseOrders.filter(o => o.status === 'partially_received').length,
  }), [purchaseOrders]);

  const requisitionTotals = useMemo(() => ({
    total: requisitions.length,
    draft: requisitions.filter(r => r.status === 'draft').length,
    pending: requisitions.filter(r => r.status === 'pending').length,
    approved: requisitions.filter(r => r.status === 'approved').length,
  }), [requisitions]);

  const tabs = [
    { value: 'dashboard', label: 'Dashboard', icon: BarChart3, count: null },
    { value: 'purchase_orders', label: 'Purchase Orders', icon: Truck, count: purchaseOrdersMeta?.total ?? purchaseOrders.length },
    { value: 'requisitions', label: 'Purchase Requisitions', icon: ClipboardList, count: requisitionsMeta?.total ?? requisitions.length },
    { value: 'goods_receipts', label: 'Goods Receipts', icon: FileText, count: goodsReceiptsMeta?.total ?? goodsReceipts.length },
    { value: 'suppliers', label: 'Suppliers', icon: Users, count: suppliers.length },
    { value: 'products', label: 'Product Master', icon: Package, count: null },
    { value: 'transfers', label: 'Transfers', icon: Layers, count: transferMeta?.total ?? transfers.length },
    { value: 'adjustments', label: 'Adjustments', icon: SlidersHorizontal, count: adjustmentsMeta?.total ?? adjustments.length },
    { value: 'reservations', label: 'Reservations', icon: ShieldCheck, count: reservationsMeta?.total ?? reservations.length },
    { value: 'stock', label: 'Stock', icon: Activity, count: stockMeta?.total ?? stockItems.length },
    { value: 'ledger', label: 'Ledger', icon: FileText, count: ledgerMeta?.total ?? ledgerEntries.length },
    { value: 'alerts', label: 'Alerts', icon: AlertTriangle, count: alerts.length },
    { value: 'reports', label: 'Reports', icon: FileSearch, count: reportsMeta?.total ?? reports.length },
  ];

  return (
    <div className="root-wrapper">
      <BackgroundBlobs />
      <div className="dashboard-container">
        <DashboardHeader userProfile={userProfile} onLogout={logout} />
        <main className="dashboard-main">
          <div className="welcome-banner" style={{ marginBottom: '24px' }}>
            <h2>Inventory Procurement</h2>
            <p>Manage products, purchase orders, goods receipts and suppliers.</p>
          </div>

          <div className="inventory-summary">
            <div className="inventory-card"><h4>Purchase Orders</h4><div className="value">{purchaseOrdersMeta?.total ?? purchaseOrders.length}</div><div className="meta">Total: ₹{purchaseOrderTotals.totalAmount?.toFixed(2)}</div></div>
            <div className="inventory-card"><h4>Open Orders</h4><div className="value">{purchaseOrderTotals.pending + purchaseOrderTotals.partial}</div><div className="meta">Pending: {purchaseOrderTotals.pending} · Partial: {purchaseOrderTotals.partial}</div></div>
            <div className="inventory-card"><h4>Goods Receipts</h4><div className="value">{goodsReceiptsMeta?.total ?? goodsReceipts.length}</div><div className="meta">Recent receipts</div></div>
            <div className="inventory-card"><h4>Requisitions</h4><div className="value">{requisitionTotals.total}</div><div className="meta">Draft: {requisitionTotals.draft} · Pending: {requisitionTotals.pending}</div></div>
            <div className="inventory-card"><h4>Suppliers</h4><div className="value">{suppliers.length}</div><div className="meta">Active suppliers</div></div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '14px', border: activeTab === tab.value ? '1px solid var(--color-primary)' : '1px solid #e2e8f0', background: activeTab === tab.value ? '#fff' : '#f8fafc', color: activeTab === tab.value ? '#0f172a' : '#475569', cursor: 'pointer', fontWeight: 700 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', background: '#eef2ff', color: 'var(--color-primary)' }}><Icon size={16} /></span>
                  <div style={{ textAlign: 'left' }}>
                    <div>{tab.label}</div>
                    {tab.count !== null && <div style={{ fontSize: '12px', color: '#64748b' }}>{tab.count} items</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Product Master Tab */}
          {activeTab === 'products' && (
            <div className="card-panel">
              <div className="panel-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Package size={18} /> Product Master</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Create products here first — they will appear in Purchase Order dropdowns.</p>
              </div>
              <ProductsTab token={token} />
            </div>
          )}

          {/* Purchase Requisitions */}
          {activeTab === 'requisitions' && (
            <div className="card-panel">
              <div className="panel-header">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ClipboardList size={18} /> Purchase Requisitions</h3>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="button" className="submit-btn" style={{ width: 'auto', padding: '12px 18px' }} onClick={() => { setEditingRequisition(null); setShowRequisitionModal(true); }}><Plus size={16} /> New Requisition</button>
                  <button type="button" onClick={loadPurchaseRequisitions} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', padding: '10px 16px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><RefreshCw size={14} /> Refresh</button>
                </div>
              </div>
              <Alert type="error" message={errorMsg} />
              <Alert type="success" message={successMsg} />
              <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input className="form-input" type="search" style={{ maxWidth: '240px' }} placeholder="Search requisitions…" value={requisitionSearch} onChange={e => setRequisitionSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadPurchaseRequisitions()} />
                <select className="form-input" style={{ maxWidth: '180px' }} value={requisitionStatusFilter} onChange={e => setRequisitionStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  {Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select className="form-input" style={{ maxWidth: '180px' }} value={requisitionPriorityFilter} onChange={e => setRequisitionPriorityFilter(e.target.value)}>
                  <option value="">All priorities</option>
                  {Object.entries(REQUISITION_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input type="date" className="form-input" style={{ maxWidth: '180px' }} value={requisitionDateFilter} onChange={e => setRequisitionDateFilter(e.target.value)} />
                <input className="form-input" style={{ maxWidth: '180px' }} type="number" placeholder="Requested by ID" value={requisitionRequestedByFilter} onChange={e => setRequisitionRequestedByFilter(e.target.value)} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="inventory-table">
                  <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Requisition Number', 'Status', 'Priority', 'Requested Date', 'Required Date', 'Requested By', 'Estimated Amount', 'Actions'].map(label => <th key={label} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</th>)}</tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading requisitions…</td></tr>
                      : requisitions.length === 0 ? <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No purchase requisitions found.</td></tr>
                      : requisitions.map(requisition => (
                        <tr key={requisition.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>{requisition.requisition_number}</td>
                          <td style={{ padding: '12px 14px' }}>{renderRequisitionStatusBadge(requisition.status)}</td>
                          <td style={{ padding: '12px 14px' }}>{REQUISITION_PRIORITY_LABELS[requisition.priority] ?? requisition.priority}</td>
                          <td style={{ padding: '12px 14px' }}>{formatDate(requisition.requested_date)}</td>
                          <td style={{ padding: '12px 14px' }}>{formatDate(requisition.required_date)}</td>
                          <td style={{ padding: '12px 14px' }}>{requisition.requested_by_name || requisition.requested_by || '—'}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>₹{Number(requisition.total_estimated_amount || 0).toFixed(2)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => openRequisitionDetails(requisition)} style={{ border: 'none', background: '#eff6ff', color: '#2563eb', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>View</button>
                              {requisition.status === 'draft' && <><button type="button" onClick={() => { setEditingRequisition(requisition); setShowRequisitionModal(true); }} style={{ border: 'none', background: '#fef3c7', color: '#92400e', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Edit</button><button type="button" onClick={() => handleRequisitionAction(requisition, 'submit')} style={{ border: 'none', background: '#dbeafe', color: '#1d4ed8', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Submit</button></>}
                              {requisition.status === 'pending' && <><button type="button" onClick={() => handleRequisitionAction(requisition, 'approve')} style={{ border: 'none', background: '#dcfce7', color: '#166534', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Approve</button><button type="button" onClick={() => handleRequisitionAction(requisition, 'reject')} style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Reject</button></>}
                              {requisition.status === 'approved' && <button type="button" onClick={() => handleRequisitionAction(requisition, 'convert')} style={{ border: 'none', background: '#dcfce7', color: '#166534', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Convert</button>}
                              {requisition.status === 'converted' && <button type="button" onClick={() => openRequisitionDetails(requisition)} style={{ border: 'none', background: '#e0f2fe', color: '#0f766e', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>View PO</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Procurement and Inventory Extensions */}
          {activeTab !== 'products' && activeTab !== 'requisitions' && (
            <div className="card-panel">
              <div className="panel-header">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {activeTab === 'dashboard' && <BarChart3 size={18} />}
                    {activeTab === 'purchase_orders' && <Truck size={18} />}
                    {activeTab === 'goods_receipts' && <FileText size={18} />}
                    {activeTab === 'suppliers' && <Users size={18} />}
                    {activeTab === 'transfers' && <Layers size={18} />}
                    {activeTab === 'adjustments' && <SlidersHorizontal size={18} />}
                    {activeTab === 'reservations' && <ShieldCheck size={18} />}
                    {activeTab === 'alerts' && <AlertTriangle size={18} />}
                    {activeTab === 'reports' && <FileSearch size={18} />}
                    {activeTab === 'stock' && <Activity size={18} />}
                    {activeTab === 'ledger' && <FileText size={18} />}
                    {activeTab === 'dashboard' && 'Inventory Dashboard'}
                    {activeTab === 'purchase_orders' && 'Purchase Orders'}
                    {activeTab === 'goods_receipts' && 'Goods Receipts'}
                    {activeTab === 'suppliers' && 'Suppliers'}
                    {activeTab === 'transfers' && 'Inventory Transfers'}
                    {activeTab === 'adjustments' && 'Stock Adjustments'}
                    {activeTab === 'reservations' && 'Stock Reservations'}
                    {activeTab === 'stock' && 'Inventory Stock'}
                    {activeTab === 'ledger' && 'Inventory Ledger'}
                    {activeTab === 'alerts' && 'Inventory Alerts'}
                    {activeTab === 'reports' && 'Inventory Reports'}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['purchase_orders', 'goods_receipts', 'suppliers', 'transfers', 'adjustments', 'reservations'].includes(activeTab) && (
                    <button type="button" className="submit-btn" style={{ width: 'auto', padding: '12px 18px' }} onClick={() => { setErrorMsg(''); setSuccessMsg(''); if (activeTab === 'purchase_orders') setShowPoModal(true); if (activeTab === 'goods_receipts') setShowGrModal(true); if (activeTab === 'suppliers') setShowSupplierModal(true); if (activeTab === 'transfers') setShowTransferModal(true); if (activeTab === 'adjustments') setShowAdjustmentModal(true); if (activeTab === 'reservations') setShowReservationModal(true); }}>
                      <Plus size={16} /> {activeTab === 'purchase_orders' ? 'New PO' : activeTab === 'goods_receipts' ? 'New Receipt' : activeTab === 'suppliers' ? 'New Supplier' : activeTab === 'transfers' ? 'New Transfer' : activeTab === 'adjustments' ? 'New Adjustment' : 'New Reservation'}
                    </button>
                  )}
                  <button type="button" onClick={() => {
                    if (activeTab === 'purchase_orders') loadPurchaseOrders();
                    if (activeTab === 'goods_receipts') loadGoodsReceipts();
                    if (activeTab === 'suppliers') loadSuppliers();
                    if (activeTab === 'transfers') loadInventoryTransfers();
                    if (activeTab === 'adjustments') loadStockAdjustments();
                    if (activeTab === 'reservations') loadStockReservations();
                    if (activeTab === 'stock') loadInventoryStock();
                    if (activeTab === 'ledger') loadInventoryLedger();
                    if (activeTab === 'dashboard') loadInventoryDashboard();
                    if (activeTab === 'alerts') loadInventoryAlerts();
                    if (activeTab === 'reports') loadInventoryReports();
                  }} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', padding: '10px 16px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><RefreshCw size={14} /> Refresh</button>
                </div>
              </div>

              <Alert type="error" message={errorMsg} />
              <Alert type="success" message={successMsg} />

              {/* Search bars */}
              <div style={{ marginBottom: '14px' }}>
                {activeTab === 'purchase_orders' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: '180px' }} value={purchaseOrderSupplierFilter} onChange={e => setPurchaseOrderSupplierFilter(e.target.value)}>
                      <option value="">All suppliers</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className="form-input" style={{ maxWidth: '180px' }} value={purchaseOrderStatusFilter} onChange={e => setPurchaseOrderStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input className="form-input" type="search" style={{ maxWidth: '240px' }} placeholder="Search POs…" value={purchaseOrderSearch} onChange={e => setPurchaseOrderSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadPurchaseOrders()} />
                  </div>
                )}
                {activeTab === 'goods_receipts' && <input className="form-input" type="search" style={{ maxWidth: '300px' }} placeholder="Search receipts…" value={goodsReceiptSearch} onChange={e => setGoodsReceiptSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadGoodsReceipts()} />}
                {activeTab === 'suppliers' && <input className="form-input" type="search" style={{ maxWidth: '300px' }} placeholder="Search suppliers…" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadSuppliers()} />}
                {activeTab === 'transfers' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: '180px' }} value={transferFromLocationFilter} onChange={e => setTransferFromLocationFilter(e.target.value)}>
                      <option value="">From location</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <select className="form-input" style={{ maxWidth: '180px' }} value={transferToLocationFilter} onChange={e => setTransferToLocationFilter(e.target.value)}>
                      <option value="">To location</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <select className="form-input" style={{ maxWidth: '180px' }} value={transferStatusFilter} onChange={e => setTransferStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      {Object.entries(TRANSFER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input className="form-input" type="search" style={{ maxWidth: '240px' }} placeholder="Search transfers…" value={transferSearch} onChange={e => setTransferSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadInventoryTransfers()} />
                  </div>
                )}
                {activeTab === 'adjustments' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: '180px' }} value={adjustmentStatusFilter} onChange={e => setAdjustmentStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      {Object.entries(ADJUSTMENT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input className="form-input" type="search" style={{ maxWidth: '240px' }} placeholder="Search adjustments…" value={adjustmentSearch} onChange={e => setAdjustmentSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadStockAdjustments()} />
                  </div>
                )}
                {activeTab === 'reservations' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: '180px' }} value={reservationStatusFilter} onChange={e => setReservationStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      {Object.entries(RESERVATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input className="form-input" type="number" style={{ maxWidth: '180px' }} placeholder="Product ID" value={reservationProductFilter} onChange={e => setReservationProductFilter(e.target.value)} />
                    <input className="form-input" type="number" style={{ maxWidth: '180px' }} placeholder="Patient ID" value={reservationPatientFilter} onChange={e => setReservationPatientFilter(e.target.value)} />
                    <input className="form-input" type="number" style={{ maxWidth: '180px' }} placeholder="Department ID" value={reservationDepartmentFilter} onChange={e => setReservationDepartmentFilter(e.target.value)} />
                    <input className="form-input" type="search" style={{ maxWidth: '240px' }} placeholder="Search reservations…" value={reservationSearch} onChange={e => setReservationSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadStockReservations()} />
                  </div>
                )}
                {activeTab === 'stock' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input className="form-input" type="search" style={{ maxWidth: '300px' }} placeholder="Search stock…" value={stockSearch} onChange={e => setStockSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadInventoryStock()} />
                  </div>
                )}
                {activeTab === 'ledger' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: '220px' }} value={ledgerTransactionFilter} onChange={e => setLedgerTransactionFilter(e.target.value)}>
                      <option value="">All transaction types</option>
                      <option value="issue">Issue</option>
                      <option value="consume">Consume</option>
                      <option value="reserve">Reserve</option>
                      <option value="release">Release</option>
                    </select>
                    <input className="form-input" type="search" style={{ maxWidth: '300px' }} placeholder="Search ledger…" value={ledgerSearch} onChange={e => setLedgerSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadInventoryLedger()} />
                  </div>
                )}
                {activeTab === 'alerts' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: '220px' }} value={alertReasonFilter} onChange={e => setAlertReasonFilter(e.target.value)}>
                      <option value="">All alerts</option>
                      {Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                )}
                {activeTab === 'reports' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: '220px' }} value={reportType} onChange={e => setReportType(e.target.value)}>
                      {Object.entries(REPORT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Tables and content */}
              {activeTab === 'purchase_orders' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['PO Number', 'Supplier', 'Date', 'Delivery ETA', 'Status', 'Total', 'Remarks'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                        : purchaseOrders.length === 0 ? <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No purchase orders found.</td></tr>
                        : purchaseOrders.map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{o.po_number}</td>
                            <td style={{ padding: '12px 14px' }}>{o.supplier_name}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(o.purchase_date)}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(o.expected_delivery_date)}</td>
                            <td style={{ padding: '12px 14px' }}>{renderStatusBadge(o.status)}</td>
                            <td style={{ padding: '12px 14px', fontWeight: 700 }}>₹{o.total_amount?.toFixed(2)}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{o.remarks || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'goods_receipts' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Receipt', 'PO', 'Supplier', 'Received', 'Remarks'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                        : goodsReceipts.length === 0 ? <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No goods receipts found.</td></tr>
                        : goodsReceipts.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{r.receipt_number}</td>
                            <td style={{ padding: '12px 14px' }}>{r.purchase_order_number}</td>
                            <td style={{ padding: '12px 14px' }}>{r.supplier_name}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(r.received_date)}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{r.remarks || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'suppliers' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Supplier', 'Phone', 'Company', 'City', 'Status', 'Remarks'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {suppliers.length === 0 ? <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No suppliers found.</td></tr>
                        : suppliers.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600 }}>{s.name}</td>
                            <td style={{ padding: '12px 14px' }}>{s.phone}</td>
                            <td style={{ padding: '12px 14px' }}>{s.company_name || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{s.city || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{s.status}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{s.remarks || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'transfers' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Transfer #', 'From', 'To', 'Created', 'Status', 'Items', 'Remarks', 'Actions'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading transfers…</td></tr>
                        : transfers.length === 0 ? <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No inventory transfers found.</td></tr>
                        : transfers.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{t.transfer_number || `TR-${t.id}`}</td>
                            <td style={{ padding: '12px 14px' }}>{t.from_location_name || t.from_location_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{t.to_location_name || t.to_location_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(t.created_at || t.created_date || t.created)}</td>
                            <td style={{ padding: '12px 14px' }}>{renderTransferStatusBadge(t.status)}</td>
                            <td style={{ padding: '12px 14px' }}>{(t.items ?? []).length}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{t.remarks || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {t.status === 'pending' && <button type="button" onClick={() => handleTransferAction(t, 'approve')} style={{ border: 'none', background: '#dbeafe', color: '#1d4ed8', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Approve</button>}
                                {t.status === 'approved' && <button type="button" onClick={() => handleTransferAction(t, 'complete')} style={{ border: 'none', background: '#dcfce7', color: '#166534', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Complete</button>}
                                {t.status !== 'completed' && t.status !== 'cancelled' && <button type="button" onClick={() => handleTransferAction(t, 'cancel')} style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'adjustments' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Adjustment #', 'Reason', 'Created', 'Status', 'Items', 'Remarks', 'Actions'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading adjustments…</td></tr>
                        : adjustments.length === 0 ? <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No stock adjustments found.</td></tr>
                        : adjustments.map(a => (
                          <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{a.adjustment_number || `AD-${a.id}`}</td>
                            <td style={{ padding: '12px 14px' }}>{a.reason || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(a.created_at || a.created_date || a.created)}</td>
                            <td style={{ padding: '12px 14px' }}>{renderAdjustmentStatusBadge(a.status)}</td>
                            <td style={{ padding: '12px 14px' }}>{(a.items ?? []).length}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{a.remarks || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {a.status === 'pending' && <button type="button" onClick={() => handleAdjustmentAction(a, 'approve')} style={{ border: 'none', background: '#dbeafe', color: '#1d4ed8', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Approve</button>}
                                {a.status !== 'approved' && a.status !== 'cancelled' && <button type="button" onClick={() => handleAdjustmentAction(a, 'cancel')} style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'reservations' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Reservation #', 'Product', 'Patient', 'Department', 'Qty', 'Status', 'Expires', 'Remarks', 'Actions'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading reservations…</td></tr>
                        : reservations.length === 0 ? <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No stock reservations found.</td></tr>
                        : reservations.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{r.reservation_number || `RS-${r.id}`}</td>
                            <td style={{ padding: '12px 14px' }}>{r.product_name || r.product_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{r.patient_name || r.patient_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{r.department_name || r.department_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{r.quantity}</td>
                            <td style={{ padding: '12px 14px' }}>{renderReservationStatusBadge(r.status)}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(r.expiry_datetime || r.expiry_date)}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{r.remarks || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {r.status === 'active' && <button type="button" onClick={() => handleReservationAction(r, 'release')} style={{ border: 'none', background: '#fde68a', color: '#92400e', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Release</button>}
                                {r.status === 'active' && <button type="button" onClick={() => handleReservationAction(r, 'consume')} style={{ border: 'none', background: '#dcfce7', color: '#166534', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>Consume</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'stock' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Product', 'Available Qty', 'Total Qty', 'Updated At'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading stock…</td></tr>
                        : stockItems.length === 0 ? <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No inventory stock found.</td></tr>
                        : stockItems.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{item.product_name || item.product_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{item.available_quantity}</td>
                            <td style={{ padding: '12px 14px' }}>{item.total_quantity}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(item.updated_at)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'ledger' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Entry', 'Product', 'Type', 'Qty', 'Before', 'After', 'Reference', 'Created At'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading ledger entries…</td></tr>
                        : ledgerEntries.length === 0 ? <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No ledger entries found.</td></tr>
                        : ledgerEntries.map(entry => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{entry.id}</td>
                            <td style={{ padding: '12px 14px' }}>{entry.product_name || entry.product_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{entry.transaction_type}</td>
                            <td style={{ padding: '12px 14px' }}>{entry.quantity}</td>
                            <td style={{ padding: '12px 14px' }}>{entry.before_quantity}</td>
                            <td style={{ padding: '12px 14px' }}>{entry.after_quantity}</td>
                            <td style={{ padding: '12px 14px' }}>{entry.reference_type ? `${entry.reference_type}#${entry.reference_id || ''}` : entry.purchase_order_id ? `PO#${entry.purchase_order_id}` : entry.goods_receipt_id ? `GR#${entry.goods_receipt_id}` : '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(entry.created_at)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'alerts' && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="inventory-table">
                    <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{['Alert', 'Type', 'Product', 'Location', 'Qty', 'Reason', 'Created'].map(l => <th key={l} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{l}</th>)}</tr></thead>
                    <tbody>
                      {loading ? <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading alerts…</td></tr>
                        : alerts.length === 0 ? <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No inventory alerts found.</td></tr>
                        : alerts.map(alert => (
                          <tr key={alert.id || `${alert.type}-${alert.created_at}` } style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '12px 14px' }}>{alert.id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{renderAlertTypeBadge(alert.reason || alert.type || '—')}</td>
                            <td style={{ padding: '12px 14px' }}>{alert.product_name || alert.product_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{alert.location_name || alert.location_id || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{alert.quantity ?? '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>{alert.message || alert.description || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{formatDate(alert.created_at || alert.created_date || alert.timestamp)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'reports' && (
                <div style={{ overflowX: 'auto' }}>
                  {reports.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No report data available.</div>
                  ) : (
                    <table className="inventory-table">
                      <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}>{Object.keys(reports[0]).slice(0, 8).map(key => <th key={key} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</th>)}</tr></thead>
                      <tbody>
                        {reports.map((row, idx) => (
                          <tr key={row.id ?? idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                            {Object.keys(row).slice(0, 8).map(col => (
                              <td key={col} style={{ padding: '12px 14px', color: typeof row[col] === 'number' ? '#0f172a' : '#475569' }}>{typeof row[col] === 'object' ? JSON.stringify(row[col]) : row[col] ?? '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'dashboard' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {dashboardMetrics ? Object.entries(dashboardMetrics).map(([key, value]) => (
                    <div key={key} style={{ padding: '20px', borderRadius: '18px', background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,0.05)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key.replace(/_/g, ' ')}</div>
                      <div style={{ marginTop: '12px', fontSize: '32px', fontWeight: 800, color: '#0f172a' }}>{typeof value === 'number' ? value : String(value)}</div>
                    </div>
                  )) : (
                    <div style={{ gridColumn: '1/-1', padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No dashboard metrics available.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create PO Modal */}
      {showPoModal && (
        <Modal title="Create Purchase Order" onClose={() => setShowPoModal(false)} wide>
          <form onSubmit={handleCreatePO} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FieldRow label="Supplier *">
                <select className="form-input" value={poForm.supplier_id} onChange={e => setPoForm(c => ({ ...c, supplier_id: e.target.value }))} required>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Purchase Date">
                <input type="date" className="form-input" value={poForm.purchase_date} onChange={e => setPoForm(c => ({ ...c, purchase_date: e.target.value }))} />
              </FieldRow>
              <FieldRow label="Expected Delivery">
                <input type="date" className="form-input" value={poForm.expected_delivery_date} onChange={e => setPoForm(c => ({ ...c, expected_delivery_date: e.target.value }))} />
              </FieldRow>
              <FieldRow label="Remarks">
                <input type="text" className="form-input" value={poForm.remarks} onChange={e => setPoForm(c => ({ ...c, remarks: e.target.value }))} />
              </FieldRow>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Purchase Order Items</h3>
                <button type="button" onClick={handleAddPOItem} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}><PlusCircle size={15} /> Add item</button>
              </div>
              {productSearchResults.length === 0 && (
                <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e', marginBottom: '10px' }}>
                  ⚠ No products found. Go to the <strong>Product Master</strong> tab first to create products.
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      {['Product', 'Qty', 'Unit Price', 'Tax %', 'Discount %', ''].map(l => <th key={l} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '11px' }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {poForm.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', minWidth: '200px' }}>
                          <select className="form-input" value={item.product_id} onChange={e => handleProductSelect(idx, e.target.value)}>
                            <option value="">Select product</option>
                            {productSearchResults.map(p => <option key={p.id} value={p.id}>{p.name}{p.product_code ? ` (${p.product_code})` : ''}{p.generic_name ? ` — ${p.generic_name}` : ''}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 10px', minWidth: '80px' }}><input type="number" min="0" step="1" className="form-input" value={item.quantity} onChange={e => handleUpdatePOItem(idx, 'quantity', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px', minWidth: '100px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.expected_unit_price} onChange={e => handleUpdatePOItem(idx, 'expected_unit_price', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px', minWidth: '70px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.tax_percent} onChange={e => handleUpdatePOItem(idx, 'tax_percent', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px', minWidth: '90px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.discount_percent} onChange={e => handleUpdatePOItem(idx, 'discount_percent', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px' }}><button type="button" onClick={() => handleRemovePOItem(idx)} style={{ border: 'none', background: '#fef2f2', color: '#b91c1c', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Alert type="error" message={errorMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowPoModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button type="submit" className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={loading}>Create Purchase Order</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create GR Modal */}
      {showGrModal && (
        <Modal title="Create Goods Receipt" onClose={() => setShowGrModal(false)} wide>
          <form onSubmit={handleCreateGR} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FieldRow label="Purchase Order *">
                <select className="form-input" value={receiptForm.purchase_order_id} onChange={e => setReceiptForm(c => ({ ...c, purchase_order_id: e.target.value }))} required>
                  <option value="">Select purchase order</option>
                  {purchaseOrders.filter(o => ['pending', 'partially_received'].includes(o.status)).map(o => <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Received Date">
                <input type="date" className="form-input" value={receiptForm.received_date} onChange={e => setReceiptForm(c => ({ ...c, received_date: e.target.value }))} />
              </FieldRow>
              <FieldRow label="Remarks" span>
                <input type="text" className="form-input" value={receiptForm.remarks} onChange={e => setReceiptForm(c => ({ ...c, remarks: e.target.value }))} />
              </FieldRow>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Receipt Items</h3>
                <span style={{ color: '#64748b', fontSize: '13px' }}>{receiptOrder ? `${receiptItems.length} item(s)` : 'Select a PO to load items'}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      {['Product', 'Remaining', 'Qty Received', 'Unit Cost', 'Batch', 'MFG Date', 'EXP Date', 'Tax%', 'Disc%'].map(l => <th key={l} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '11px' }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {receiptItems.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Select a purchase order with pending quantities.</td></tr>
                    ) : receiptItems.map((item, idx) => (
                      <tr key={item.purchase_order_item_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', minWidth: '140px', fontWeight: 600 }}>{item.product_name}</td>
                        <td style={{ padding: '8px 10px' }}>{item.remaining_quantity}</td>
                        <td style={{ padding: '8px 10px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.received_quantity} onChange={e => setReceiptItems(c => { const n=[...c]; n[idx]={...n[idx],received_quantity:e.target.value}; return n; })} /></td>
                        <td style={{ padding: '8px 10px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.unit_cost} onChange={e => setReceiptItems(c => { const n=[...c]; n[idx]={...n[idx],unit_cost:e.target.value}; return n; })} /></td>
                        <td style={{ padding: '8px 10px' }}><input type="text" className="form-input" value={item.batch_number} onChange={e => setReceiptItems(c => { const n=[...c]; n[idx]={...n[idx],batch_number:e.target.value}; return n; })} /></td>
                        <td style={{ padding: '8px 10px' }}><input type="date" className="form-input" value={item.manufacturing_date} onChange={e => setReceiptItems(c => { const n=[...c]; n[idx]={...n[idx],manufacturing_date:e.target.value}; return n; })} /></td>
                        <td style={{ padding: '8px 10px' }}><input type="date" className="form-input" value={item.expiry_date} onChange={e => setReceiptItems(c => { const n=[...c]; n[idx]={...n[idx],expiry_date:e.target.value}; return n; })} /></td>
                        <td style={{ padding: '8px 10px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.tax_percent} onChange={e => setReceiptItems(c => { const n=[...c]; n[idx]={...n[idx],tax_percent:e.target.value}; return n; })} /></td>
                        <td style={{ padding: '8px 10px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.discount_percent} onChange={e => setReceiptItems(c => { const n=[...c]; n[idx]={...n[idx],discount_percent:e.target.value}; return n; })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Alert type="error" message={errorMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowGrModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button type="submit" className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={loading || receiptItems.length === 0}>Create Goods Receipt</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Requisition Modal */}
      {showRequisitionModal && (
        <Modal title={editingRequisition ? 'Edit Purchase Requisition' : 'Create Purchase Requisition'} onClose={() => { setShowRequisitionModal(false); setEditingRequisition(null); }} wide>
          <RequisitionForm
            token={token}
            initial={editingRequisition}
            onSaved={() => { setShowRequisitionModal(false); setEditingRequisition(null); setSuccessMsg(editingRequisition ? 'Requisition updated.' : 'Requisition created.'); loadPurchaseRequisitions(); }}
            onClose={() => { setShowRequisitionModal(false); setEditingRequisition(null); }}
            searchProducts={searchProducts}
            productSearchResults={productSearchResults}
            setErrorMsg={setErrorMsg}
          />
        </Modal>
      )}

      {/* Requisition Details Modal */}
      {showRequisitionDetailModal && selectedRequisition && (
        <Modal title={`Requisition ${selectedRequisition.requisition_number}`} onClose={() => { setShowRequisitionDetailModal(false); setSelectedRequisition(null); }} wide>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div><div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Status</div><div style={{ fontWeight: 700 }}>{renderRequisitionStatusBadge(selectedRequisition.status)}</div></div>
              <div><div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Priority</div><div style={{ fontWeight: 700 }}>{REQUISITION_PRIORITY_LABELS[selectedRequisition.priority] ?? selectedRequisition.priority}</div></div>
              <div><div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Requested Date</div><div style={{ fontWeight: 700 }}>{formatDate(selectedRequisition.requested_date)}</div></div>
              <div><div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Required Date</div><div style={{ fontWeight: 700 }}>{formatDate(selectedRequisition.required_date)}</div></div>
              <div><div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Requested By</div><div style={{ fontWeight: 700 }}>{selectedRequisition.requested_by_name || selectedRequisition.requested_by || '—'}</div></div>
              <div><div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Amount</div><div style={{ fontWeight: 700 }}>₹{Number(selectedRequisition.total_estimated_amount || 0).toFixed(2)}</div></div>
            </div>
            <div><div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Remarks</div><div style={{ fontWeight: 500 }}>{selectedRequisition.remarks || '—'}</div></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}>{['Product', 'Qty', 'Unit Price', 'Estimated Total', 'Remarks'].map(label => <th key={label} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>{label}</th>)}</tr></thead>
                <tbody>
                  {(selectedRequisition.items ?? []).map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{item.product_name || item.product_code || item.product_id}</td>
                      <td style={{ padding: '8px 10px' }}>{item.requested_quantity}</td>
                      <td style={{ padding: '8px 10px' }}>₹{Number(item.estimated_unit_price || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px' }}>₹{Number(item.estimated_total || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{item.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Supplier Modal */}
      {showSupplierModal && (
        <Modal title="Create Supplier" onClose={() => setShowSupplierModal(false)}>
          <form onSubmit={handleCreateSupplier} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FieldRow label="Supplier Name *"><input className="form-input" value={supplierForm.name} onChange={e => setSupplierForm(c => ({ ...c, name: e.target.value }))} required /></FieldRow>
            <FieldRow label="Phone *"><input className="form-input" value={supplierForm.phone} onChange={e => setSupplierForm(c => ({ ...c, phone: e.target.value }))} required /></FieldRow>
            <FieldRow label="Company"><input className="form-input" value={supplierForm.company_name} onChange={e => setSupplierForm(c => ({ ...c, company_name: e.target.value }))} /></FieldRow>
            <FieldRow label="Email"><input type="email" className="form-input" value={supplierForm.email} onChange={e => setSupplierForm(c => ({ ...c, email: e.target.value }))} /></FieldRow>
            <FieldRow label="Contact Person"><input className="form-input" value={supplierForm.contact_person} onChange={e => setSupplierForm(c => ({ ...c, contact_person: e.target.value }))} /></FieldRow>
            <FieldRow label="Status">
              <select className="form-input" value={supplierForm.status} onChange={e => setSupplierForm(c => ({ ...c, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FieldRow>
            <FieldRow label="Address"><input className="form-input" value={supplierForm.address} onChange={e => setSupplierForm(c => ({ ...c, address: e.target.value }))} /></FieldRow>
            <FieldRow label="City"><input className="form-input" value={supplierForm.city} onChange={e => setSupplierForm(c => ({ ...c, city: e.target.value }))} /></FieldRow>
            <FieldRow label="State"><input className="form-input" value={supplierForm.state} onChange={e => setSupplierForm(c => ({ ...c, state: e.target.value }))} /></FieldRow>
            <FieldRow label="Country"><input className="form-input" value={supplierForm.country} onChange={e => setSupplierForm(c => ({ ...c, country: e.target.value }))} /></FieldRow>
            <FieldRow label="Postal Code"><input className="form-input" value={supplierForm.postal_code} onChange={e => setSupplierForm(c => ({ ...c, postal_code: e.target.value }))} /></FieldRow>
            <FieldRow label="Remarks"><input className="form-input" value={supplierForm.remarks} onChange={e => setSupplierForm(c => ({ ...c, remarks: e.target.value }))} /></FieldRow>
            <Alert type="error" message={errorMsg} />
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowSupplierModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button type="submit" className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={loading}>Save Supplier</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Transfer Modal */}
      {showTransferModal && (
        <Modal title="Create Inventory Transfer" onClose={() => setShowTransferModal(false)} wide>
          <form onSubmit={handleCreateTransfer} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FieldRow label="From Location *">
                <select className="form-input" value={transferForm.from_location_id} onChange={e => setTransferForm(c => ({ ...c, from_location_id: e.target.value }))} required>
                  <option value="">Select source</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="To Location *">
                <select className="form-input" value={transferForm.to_location_id} onChange={e => setTransferForm(c => ({ ...c, to_location_id: e.target.value }))} required>
                  <option value="">Select destination</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </FieldRow>
              <FieldRow label="Remarks" span>
                <input className="form-input" value={transferForm.remarks} onChange={e => setTransferForm(c => ({ ...c, remarks: e.target.value }))} />
              </FieldRow>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Transfer Items</h3>
                <button type="button" onClick={handleAddTransferItem} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>Add item</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      {['Product', 'Qty', 'Remarks', ''].map(l => <th key={l} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '11px' }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {transferForm.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', minWidth: '200px' }}>
                          <select className="form-input" value={item.product_id} onChange={e => handleUpdateTransferItem(idx, 'product_id', e.target.value)}>
                            <option value="">Select product</option>
                            {productSearchResults.map(p => <option key={p.id} value={p.id}>{p.name}{p.product_code ? ` (${p.product_code})` : ''}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 10px', minWidth: '90px' }}><input type="number" min="0" step="1" className="form-input" value={item.quantity} onChange={e => handleUpdateTransferItem(idx, 'quantity', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px' }}><input className="form-input" value={item.remarks} onChange={e => handleUpdateTransferItem(idx, 'remarks', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px' }}><button type="button" onClick={() => handleRemoveTransferItem(idx)} style={{ border: 'none', background: '#fef2f2', color: '#b91c1c', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Alert type="error" message={errorMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowTransferModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button type="submit" className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={loading}>Create Transfer</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Adjustment Modal */}
      {showAdjustmentModal && (
        <Modal title="Create Stock Adjustment" onClose={() => setShowAdjustmentModal(false)} wide>
          <form onSubmit={handleCreateAdjustment} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FieldRow label="Reason *"><input className="form-input" value={adjustmentForm.reason} onChange={e => setAdjustmentForm(c => ({ ...c, reason: e.target.value }))} required /></FieldRow>
              <FieldRow label="Remarks" span><input className="form-input" value={adjustmentForm.remarks} onChange={e => setAdjustmentForm(c => ({ ...c, remarks: e.target.value }))} /></FieldRow>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Adjustment Items</h3>
                <button type="button" onClick={handleAddAdjustmentItem} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>Add item</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      {['Product', 'Qty', 'Unit Cost', 'Remarks', ''].map(l => <th key={l} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: '11px' }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentForm.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', minWidth: '180px' }}>
                          <select className="form-input" value={item.product_id} onChange={e => handleUpdateAdjustmentItem(idx, 'product_id', e.target.value)}>
                            <option value="">Select product</option>
                            {productSearchResults.map(p => <option key={p.id} value={p.id}>{p.name}{p.product_code ? ` (${p.product_code})` : ''}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 10px', minWidth: '90px' }}><input type="number" min="0" step="1" className="form-input" value={item.quantity} onChange={e => handleUpdateAdjustmentItem(idx, 'quantity', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px', minWidth: '100px' }}><input type="number" min="0" step="0.01" className="form-input" value={item.unit_cost} onChange={e => handleUpdateAdjustmentItem(idx, 'unit_cost', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px' }}><input className="form-input" value={item.remarks} onChange={e => handleUpdateAdjustmentItem(idx, 'remarks', e.target.value)} /></td>
                        <td style={{ padding: '8px 10px' }}><button type="button" onClick={() => handleRemoveAdjustmentItem(idx)} style={{ border: 'none', background: '#fef2f2', color: '#b91c1c', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Alert type="error" message={errorMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowAdjustmentModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button type="submit" className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={loading}>Create Adjustment</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Reservation Modal */}
      {showReservationModal && (
        <Modal title="Create Stock Reservation" onClose={() => setShowReservationModal(false)}>
          <form onSubmit={handleCreateReservation} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <FieldRow label="Product *"><input className="form-input" value={reservationForm.product_id} onChange={e => setReservationForm(c => ({ ...c, product_id: e.target.value }))} required /></FieldRow>
              <FieldRow label="Quantity *"><input type="number" min="0" className="form-input" value={reservationForm.quantity} onChange={e => setReservationForm(c => ({ ...c, quantity: e.target.value }))} required /></FieldRow>
              <FieldRow label="Patient ID"><input type="number" className="form-input" value={reservationForm.patient_id} onChange={e => setReservationForm(c => ({ ...c, patient_id: e.target.value }))} /></FieldRow>
              <FieldRow label="Department ID"><input type="number" className="form-input" value={reservationForm.department_id} onChange={e => setReservationForm(c => ({ ...c, department_id: e.target.value }))} /></FieldRow>
              <FieldRow label="Batch Number"><input className="form-input" value={reservationForm.batch_number} onChange={e => setReservationForm(c => ({ ...c, batch_number: e.target.value }))} /></FieldRow>
              <FieldRow label="Expiry Date"><input type="date" className="form-input" value={reservationForm.expiry_datetime} onChange={e => setReservationForm(c => ({ ...c, expiry_datetime: e.target.value }))} /></FieldRow>
              <FieldRow label="Remarks" span><input className="form-input" value={reservationForm.remarks} onChange={e => setReservationForm(c => ({ ...c, remarks: e.target.value }))} /></FieldRow>
            </div>
            <Alert type="error" message={errorMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowReservationModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button type="submit" className="submit-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={loading}>Create Reservation</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

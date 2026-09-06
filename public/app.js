const API_URL = '';

let menuData = [];
let staffData = [];
let cart = [];
let activeRole = 'customer';
let selectedTable = 4;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  fetchMenu();
  fetchStaff();
  fetchOrders();
  setInterval(fetchOrders, 4000); // Poll for live order updates
});

function switchRole(role) {
  activeRole = role;
  document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

  document.getElementById(`btn-role-${role}`).classList.add('active');
  document.getElementById(`view-${role}`).classList.add('active');
  fetchOrders();
}

// Fetch Menu
async function fetchMenu() {
  try {
    const res = await fetch(`${API_URL}/api/menu`);
    if (!res.ok) throw new Error('Failed to fetch menu');
    menuData = await res.json();
    renderMenu(menuData);
  } catch (err) {
    console.error('Menu Error:', err);
  }
}

function renderMenu(items) {
  const grid = document.getElementById('menu-grid');
  if (!items || items.length === 0) {
    grid.innerHTML = '<p class="empty-msg">No menu items found. Please check database setup.</p>';
    return;
  }

  grid.innerHTML = items.map(item => {
    const numPrice = parseFloat(item.price) || 0;
    return `
      <div class="menu-card">
        <div>
          <h4>${item.name}</h4>
          <div class="prep">⏱️ Prep: ~${item.prep_time_minutes} mins</div>
        </div>
        <div class="bottom">
          <span class="price">$${numPrice.toFixed(2)}</span>
          <button class="btn-add" onclick="addToCart(${item.id})">+ Add</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterMenu(category) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (event) event.target.classList.add('active');
  if (category === 'all') renderMenu(menuData);
  else renderMenu(menuData.filter(i => i.category === category));
}

// Cart Management
function addToCart(itemId) {
  const item = menuData.find(m => Number(m.id) === Number(itemId));
  if (!item) return;

  const existing = cart.find(c => Number(c.id) === Number(itemId));
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1, price: parseFloat(item.price) });
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');

  if (cart.length === 0) {
    container.innerHTML = `<p class="empty-msg">Your cart is currently empty.</p>`;
    totalEl.innerText = `$0.00`;
    return;
  }

  let total = 0;
  container.innerHTML = cart.map(i => {
    const itemTotal = parseFloat(i.price) * i.quantity;
    total += itemTotal;
    return `
      <div class="cart-item">
        <span>${i.name} x${i.quantity}</span>
        <span>$${itemTotal.toFixed(2)}</span>
      </div>
    `;
  }).join('');

  totalEl.innerText = `$${total.toFixed(2)}`;
}

async function submitOrder() {
  if (cart.length === 0) return alert('Add items to cart first!');
  const tableSelect = document.getElementById('table-number-select');
  const table_number = tableSelect ? parseInt(tableSelect.value) : selectedTable;

  try {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_number, items: cart })
    });

    if (res.ok) {
      cart = [];
      renderCart();
      fetchOrders();
      alert(`Order submitted successfully for Table #${table_number}!`);
    } else {
      alert('Failed to place order.');
    }
  } catch (err) {
    console.error(err);
  }
}

// Fetch Staff
async function fetchStaff() {
  try {
    const res = await fetch(`${API_URL}/api/staff`);
    staffData = await res.json();
  } catch (err) {
    console.error('Staff Error:', err);
  }
}

// Fetch Orders
async function fetchOrders() {
  try {
    const res = await fetch(`${API_URL}/api/orders`);
    const orders = await res.json();
    
    if (activeRole === 'customer') renderCustomerOrders(orders);
    else renderWaiterOrders(orders);
  } catch (err) {
    console.error('Orders Error:', err);
  }
}

// BONUS FEATURE 1: Visual Order Progress Pipeline
function getProgressStep(status) {
  if (status === 'Pending') return 'Step 1/3: Order Sent to Kitchen ⏳';
  if (status === 'Served') return 'Step 2/3: Prepared & Served 🍽️';
  if (status === 'Paid') return 'Step 3/3: Payment Finalized ✓';
  return 'In Progress';
}

// Render Orders in Customer View
function renderCustomerOrders(orders) {
  const container = document.getElementById('customer-orders-list');
  if (!orders || orders.length === 0) {
    container.innerHTML = '<p class="empty-msg">No recent orders.</p>';
    return;
  }

  container.innerHTML = orders.map(o => {
    const amount = parseFloat(o.total_amount) || 0;
    return `
      <div style="border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-top: 10px; background: rgba(255,255,255,0.02);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>Order #${o.id} (Table #${o.table_number})</strong>
          <span class="order-badge badge-${o.status.toLowerCase()}">${o.status}</span>
        </div>
        
        <!-- BONUS: Progress Indicator -->
        <p style="font-size: 0.75rem; color: var(--accent-yellow); margin-top: 4px;">
          📌 ${getProgressStep(o.status)}
        </p>

        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 6px 0;">
          ⏱️ Est. Wait Time: <strong>${o.estimated_wait_time} mins</strong>
        </p>
        <p style="font-size: 0.85rem;">Total: <strong>$${amount.toFixed(2)}</strong></p>

        ${o.status === 'Served' && !o.is_paid ? `
          <button class="btn-primary" style="background:var(--accent-green); margin-top:8px;" onclick="payOrder(${o.id})">
            Pay Order ($${amount.toFixed(2)}) [PRETEND PAYMENT]
          </button>
        ` : ''}

        ${o.is_paid ? `<div class="pretend-paid-banner">✓ PAID (PRETEND PAYMENT RECORDED)</div>` : ''}

        ${!o.rating ? `
          <div style="margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
            <p style="font-size:0.75rem; color:var(--text-muted)">Experiencing Delays? Rate / Complain:</p>
            <div style="display:flex; gap:5px; margin-top:4px;">
              <input type="number" id="rating-${o.id}" min="1" max="5" placeholder="Rating (1-5)" style="width:70px; padding:4px;">
              <input type="text" id="complaint-${o.id}" placeholder="Complaint..." style="flex:1; padding:4px;">
              <button onclick="submitComplaint(${o.id})" style="padding:4px 8px; background:var(--primary); color:#fff; border:none; border-radius:4px; cursor:pointer;">Send</button>
            </div>
          </div>
        ` : `<p style="font-size:0.75rem; color:var(--accent-yellow); margin-top:6px;">⭐ Rating: ${o.rating}/5 ${o.complaint_text ? `| "${o.complaint_text}"` : ''}</p>`}
      </div>
    `;
  }).join('');
}

// Render Orders in Waiter View
function renderWaiterOrders(orders) {
  const container = document.getElementById('waiter-orders-grid');
  if (!orders || orders.length === 0) {
    container.innerHTML = '<p class="empty-msg">No active orders in system.</p>';
    return;
  }

  const waiters = staffData.filter(s => s.role === 'waiter');
  const chefs = staffData.filter(s => s.role === 'chef');
  const bartenders = staffData.filter(s => s.role === 'bartender');

  container.innerHTML = orders.map(o => {
    const amount = parseFloat(o.total_amount) || 0;
    const itemList = (o.items || []).filter(i => i.name).map(i => `${i.name} (x${i.quantity})`).join(', ') || 'Standard Item';

    return `
      <div class="order-card-admin">
        <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
          <h3>Order #${o.id} (Table ${o.table_number})</h3>
          <span class="order-badge badge-${o.status.toLowerCase()}">${o.status}</span>
        </div>
        
        <p style="font-size: 0.9rem;"><strong>Items:</strong> ${itemList}</p>
        <p style="margin-top:4px; font-size: 0.9rem;"><strong>Total:</strong> $${amount.toFixed(2)}</p>

        ${o.status === 'Pending' ? `
          <div class="select-group">
            <label>Assign Waiter:</label>
            <select id="select-waiter-${o.id}">
              ${waiters.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
            </select>
          </div>
          <div class="select-group">
            <label>Assign Chef:</label>
            <select id="select-chef-${o.id}">
              ${chefs.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="select-group">
            <label>Assign Bartender:</label>
            <select id="select-bartender-${o.id}">
              ${bartenders.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
            </select>
          </div>
          <button class="btn-primary" onclick="assignStaff(${o.id})">Mark Prepared & Served</button>
        ` : `
          <div style="margin-top:10px; font-size:0.85rem; color:var(--text-muted);">
            <p>👨‍🍳 Chef: ${o.chef_name || 'N/A'}</p>
            <p>🍸 Bartender: ${o.bartender_name || 'N/A'}</p>
            <p>💁 Waiter: ${o.waiter_name || 'N/A'}</p>
          </div>
        `}

        ${o.is_paid ? `<div class="pretend-paid-banner">✓ ORDER PAID (PRETEND PAYMENT)</div>` : ''}
      </div>
    `;
  }).join('');
}

// Actions
async function assignStaff(orderId) {
  const waiter_id = document.getElementById(`select-waiter-${orderId}`).value;
  const chef_id = document.getElementById(`select-chef-${orderId}`).value;
  const bartender_id = document.getElementById(`select-bartender-${orderId}`).value;

  await fetch(`${API_URL}/api/orders/${orderId}/assign`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ waiter_id, chef_id, bartender_id })
  });

  fetchOrders();
}

async function submitComplaint(orderId) {
  const rating = document.getElementById(`rating-${orderId}`).value;
  const complaint_text = document.getElementById(`complaint-${orderId}`).value;

  if (!rating) return alert('Please enter a rating between 1 and 5');

  await fetch(`${API_URL}/api/orders/${orderId}/complaint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, complaint_text })
  });

  fetchOrders();
  alert('Feedback recorded!');
}

async function payOrder(orderId) {
  await fetch(`${API_URL}/api/orders/${orderId}/pay`, {
    method: 'POST'
  });
  fetchOrders();
  alert('Pretend payment successful!');
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTES ---

// 1. Get Menu Items
app.get('/api/menu', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM menu_items ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Staff List
app.get('/api/staff', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM staff ORDER BY role, name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Place Order
app.post('/api/orders', async (req, res) => {
  const { table_number, items } = req.body; // items = [{ id, quantity, price, prep_time }]
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    await pool.query('BEGIN');

    // Calculate total amount & estimated prep time (Max prep time + small buffer)
    const total_amount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const max_prep = Math.max(...items.map(i => i.prep_time_minutes));
    const estimated_wait_time = max_prep + (items.length * 2); 

    const orderRes = await pool.query(
      `INSERT INTO orders (table_number, total_amount, estimated_wait_time, status) 
       VALUES ($1, $2, $3, 'Pending') RETURNING *`,
      [table_number || 1, total_amount, estimated_wait_time]
    );

    const order = orderRes.rows[0];

    for (const item of items) {
      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.id, item.quantity, item.price]
      );
    }

    await pool.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// 4. Get All Orders (With Detailed Items)
app.get('/api/orders', async (req, res) => {
  try {
    const query = `
      SELECT o.*, 
             w.name as waiter_name, 
             c.name as chef_name, 
             b.name as bartender_name,
             JSON_AGG(JSON_BUILD_OBJECT('name', m.name, 'quantity', oi.quantity, 'category', m.category)) as items
      FROM orders o
      LEFT JOIN staff w ON o.waiter_id = w.id
      LEFT JOIN staff c ON o.chef_id = c.id
      LEFT JOIN staff b ON o.bartender_id = b.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items m ON oi.menu_item_id = m.id
      GROUP BY o.id, w.name, c.name, b.name
      ORDER BY o.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Waiter Assigns Staff & Updates Status to Served
app.put('/api/orders/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { waiter_id, chef_id, bartender_id } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE orders 
       SET waiter_id = $1, chef_id = $2, bartender_id = $3, status = 'Served'
       WHERE id = $4 RETURNING *`,
      [waiter_id, chef_id, bartender_id, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Customer Submit Rating & Delay Complaint
app.post('/api/orders/:id/complaint', async (req, res) => {
  const { id } = req.params;
  const { rating, complaint_text } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE orders 
       SET rating = $1, complaint_text = $2 
       WHERE id = $3 RETURNING *`,
      [rating, complaint_text, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Process Pretend Payment
app.post('/api/orders/:id/pay', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE orders 
       SET is_paid = TRUE, status = 'Paid' 
       WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json({ message: 'Payment successful', order: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Chowly Server running on port ${PORT}`);
});
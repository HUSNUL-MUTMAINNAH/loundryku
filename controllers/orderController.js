const db = require('../config/db');

// POST /orders — Buat pesanan baru
const createOrder = async (req, res) => {
  const { service_id, pickup_address, pickup_lat, pickup_lng, pickup_scheduled_at } = req.body;
  const customer_id = req.user.user_id;

  if (!service_id || !pickup_address || !pickup_lat || !pickup_lng || !pickup_scheduled_at) {
    return res.status(400).json({ message: 'Semua field wajib diisi.' });
  }

  try {
    // Validasi service
    const [services] = await db.query('SELECT * FROM services WHERE service_id = ?', [service_id]);
    if (services.length === 0) {
      return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    }

    const order_id = `ORD${Date.now()}`;
    await db.query(
      `INSERT INTO orders (order_id, customer_id, service_id, pickup_address, pickup_lat, pickup_lng, pickup_scheduled_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [order_id, customer_id, service_id, pickup_address, pickup_lat, pickup_lng, pickup_scheduled_at]
    );

    // Buat invoice otomatis
    const invoice_id = `INV${Date.now()}`;
    await db.query(
      `INSERT INTO invoices (invoice_id, order_id, amount, status) VALUES (?, ?, ?, 'unpaid')`,
      [invoice_id, order_id, services[0].price_per_kg]
    );

    return res.status(201).json({
      message: 'Pesanan berhasil dibuat.',
      data: { order_id, invoice_id, status: 'pending', service_id, pickup_address, pickup_scheduled_at },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /orders/my-orders — Daftar pesanan milik customer
const getMyOrders = async (req, res) => {
  const customer_id = req.user.user_id;
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query  = 'SELECT * FROM orders WHERE customer_id = ?';
    let params = [customer_id];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [orders] = await db.query(query, params);
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM orders WHERE customer_id = ?' + (status ? ' AND status = ?' : ''),
      status ? [customer_id, status] : [customer_id]
    );

    return res.status(200).json({
      message: 'Success',
      data: orders,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /orders/:order_id — Detail pesanan
const getOrderDetail = async (req, res) => {
  const { order_id } = req.params;
  const user = req.user;

  try {
    const [orders] = await db.query(
      `SELECT o.*, s.name AS service_name, s.price_per_kg,
              i.invoice_id, i.amount, i.status AS payment_status
       FROM orders o
       LEFT JOIN services s ON o.service_id = s.service_id
       LEFT JOIN invoices i ON o.order_id = i.order_id
       WHERE o.order_id = ?`,
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
    }

    const order = orders[0];

    // Customer hanya bisa lihat pesanannya sendiri
    if (user.role === 'customer' && order.customer_id !== user.user_id) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }

    return res.status(200).json({ message: 'Success', data: order });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH /orders/:order_id/status — Update status (owner)
const updateOrderStatus = async (req, res) => {
  const { order_id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'confirmed', 'picked_up', 'processing', 'ready', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Status tidak valid. Pilih: ${validStatuses.join(', ')}` });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
    }

    await db.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?', [status, order_id]);

    // Kirim notifikasi ke customer
    await db.query(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [orders[0].customer_id, 'Status Pesanan Diperbarui', `Pesanan ${order_id} sekarang berstatus: ${status}`]
    );

    return res.status(200).json({ message: 'Status pesanan berhasil diperbarui.', data: { order_id, status } });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /orders/:order_id/assign-courier — Tugaskan kurir (owner)
const assignCourier = async (req, res) => {
  const { order_id } = req.params;
  const { courier_id, task_type } = req.body;

  if (!courier_id || !task_type) {
    return res.status(400).json({ message: 'courier_id dan task_type wajib diisi.' });
  }

  const validTaskTypes = ['pickup', 'delivery'];
  if (!validTaskTypes.includes(task_type)) {
    return res.status(400).json({ message: `task_type tidak valid. Pilih: ${validTaskTypes.join(', ')}` });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
    }

    const [couriers] = await db.query('SELECT * FROM users WHERE user_id = ? AND role = "courier"', [courier_id]);
    if (couriers.length === 0) {
      return res.status(404).json({ message: 'Kurir tidak ditemukan.' });
    }

    const assignment_id = `ASG${Date.now()}`;
    await db.query(
      `INSERT INTO courier_assignments (assignment_id, order_id, courier_id, task_type, status)
       VALUES (?, ?, ?, ?, 'assigned')`,
      [assignment_id, order_id, courier_id, task_type]
    );

    // Notifikasi ke kurir
    await db.query(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [courier_id, 'Tugas Baru', `Anda ditugaskan untuk ${task_type} pesanan ${order_id}`]
    );

    return res.status(201).json({
      message: 'Kurir berhasil ditugaskan.',
      data: { assignment_id, order_id, courier_id, task_type, status: 'assigned' },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /orders/:order_id/tracking — Tracking lokasi kurir (customer)
const trackOrder = async (req, res) => {
  const { order_id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT ca.assignment_id, ca.status AS task_status,
              u.user_id AS courier_id, u.full_name AS name,
              cl.lat, cl.lng, cl.updated_at
       FROM courier_assignments ca
       JOIN users u ON ca.courier_id = u.user_id
       LEFT JOIN courier_locations cl ON ca.assignment_id = cl.assignment_id
       WHERE ca.order_id = ? AND ca.task_type = 'pickup'
       ORDER BY cl.updated_at DESC LIMIT 1`,
      [order_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data tracking tidak ditemukan.' });
    }

    const r = rows[0];
    return res.status(200).json({
      message: 'Success',
      data: {
        order_id,
        courier: { courier_id: r.courier_id, name: r.name },
        location: { lat: r.lat, lng: r.lng },
        task_status: r.task_status,
        updated_at: r.updated_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /orders/:order_id/ratings — Beri rating & review
const rateOrder = async (req, res) => {
  const { order_id } = req.params;
  const { rating, review } = req.body;
  const customer_id = req.user.user_id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating harus antara 1–5.' });
  }

  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE order_id = ? AND customer_id = ? AND status = "delivered"',
      [order_id, customer_id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan atau belum selesai.' });
    }

    const [existing] = await db.query('SELECT * FROM ratings WHERE order_id = ?', [order_id]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Pesanan ini sudah diberi rating.' });
    }

    await db.query(
      'INSERT INTO ratings (order_id, customer_id, rating, review) VALUES (?, ?, ?, ?)',
      [order_id, customer_id, rating, review || null]
    );

    return res.status(201).json({ message: 'Rating berhasil disimpan.', data: { order_id, rating, review } });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { createOrder, getMyOrders, getOrderDetail, updateOrderStatus, assignCourier, trackOrder, rateOrder };

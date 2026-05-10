const db = require('../config/db');

// ── Haversine formula ──────────────────────────────────────────────────────
/**
 * Menghitung jarak (km) antara dua koordinat GPS.
 * Hasil sudah × 2 (pergi + pulang) sesuai skema bisnis.
 */
function haversineRoundTrip(lat1, lng1, lat2, lng2) {
  const R = 6371; // radius bumi km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c * 2).toFixed(2)); // × 2 (round trip)
}

// ── Konstanta tarif ────────────────────────────────────────────────────────
const DELIVERY_RATE_PER_KM  = 250;  // Rp per km
const ADMIN_COMMISSION_RATE = 0.15; // 15 %
const COURIER_EARNING_RATE  = 0.80; // 80 % dari delivery_fee

// ── POST /orders ───────────────────────────────────────────────────────────
// Customer membuat pesanan baru (status: pending)
const createOrder = async (req, res) => {
  const { service_id, pickup_address, pickup_lat, pickup_lng, pickup_scheduled_at } = req.body;
  const customer_id = req.user.user_id;

  if (!service_id || !pickup_address || !pickup_lat || !pickup_lng || !pickup_scheduled_at) {
    return res.status(400).json({ message: 'Semua field wajib diisi.' });
  }

  try {
    const [services] = await db.query('SELECT * FROM services WHERE service_id = ? AND is_active = 1', [service_id]);
    if (services.length === 0) {
      return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    }

    const order_id   = `ORD${Date.now()}`;
    const invoice_id = `INV${Date.now()}`;

    await db.query(
      `INSERT INTO orders
         (order_id, customer_id, service_id, pickup_address, pickup_lat, pickup_lng, pickup_scheduled_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [order_id, customer_id, service_id, pickup_address, pickup_lat, pickup_lng, pickup_scheduled_at]
    );

    // Invoice dibuat dengan amount=0 dulu; akan diupdate saat berat diinput
    await db.query(
      `INSERT INTO invoices (invoice_id, order_id, amount, service_fee, delivery_fee, status)
       VALUES (?, ?, 0, 0, 0, 'unpaid')`,
      [invoice_id, order_id]
    );

    return res.status(201).json({
      message: 'Pesanan berhasil dibuat. Menunggu konfirmasi owner.',
      data: { order_id, invoice_id, status: 'pending', service_id, pickup_address, pickup_scheduled_at },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── PATCH /orders/:order_id/weight ────────────────────────────────────────
// Owner menginput berat laundry → backend hitung semua biaya → status: processing
const inputWeight = async (req, res) => {
  const { order_id } = req.params;
  const { weight_kg } = req.body;

  if (!weight_kg || isNaN(weight_kg) || parseFloat(weight_kg) <= 0) {
    return res.status(400).json({ message: 'weight_kg wajib diisi dan harus angka positif.' });
  }

  try {
    // 1. Ambil data order beserta layanan
    const [orders] = await db.query(
      `SELECT o.*, s.price_per_kg
       FROM orders o
       JOIN services s ON o.service_id = s.service_id
       WHERE o.order_id = ?`,
      [order_id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
    }

    const order = orders[0];

    if (!['confirmed', 'picked_up'].includes(order.status)) {
      return res.status(400).json({
        message: `Berat hanya bisa diinput saat status 'confirmed' atau 'picked_up'. Status saat ini: ${order.status}`,
      });
    }

    if (!order.pickup_lat || !order.pickup_lng) {
      return res.status(400).json({ message: 'Koordinat pickup tidak tersedia di order ini.' });
    }

    // 2. Ambil koordinat owner
    const [owners] = await db.query(
      `SELECT u.lat, u.lng FROM users u WHERE u.role = 'owner' AND u.is_verified = 1 AND u.lat IS NOT NULL LIMIT 1`
    );
    if (owners.length === 0) {
      return res.status(400).json({ message: 'Koordinat owner belum diset. Update profil owner terlebih dahulu.' });
    }

    const owner = owners[0];
    const wKg   = parseFloat(weight_kg);

    // 3. Kalkulasi biaya
    const distance_km      = haversineRoundTrip(
      parseFloat(order.pickup_lat), parseFloat(order.pickup_lng),
      parseFloat(owner.lat),        parseFloat(owner.lng)
    );
    const service_fee      = parseFloat((wKg * order.price_per_kg).toFixed(2));
    const delivery_fee     = parseFloat((distance_km * DELIVERY_RATE_PER_KM).toFixed(2));
    const admin_commission = parseFloat((service_fee * ADMIN_COMMISSION_RATE).toFixed(2));
    const owner_earning    = parseFloat((service_fee - admin_commission).toFixed(2));
    const courier_earning  = parseFloat((delivery_fee * COURIER_EARNING_RATE).toFixed(2));
    const total_amount     = parseFloat((service_fee + delivery_fee).toFixed(2));

    // 4. Update orders
    await db.query(
      `UPDATE orders SET
         weight_kg        = ?,
         service_fee      = ?,
         delivery_fee     = ?,
         distance_km      = ?,
         admin_commission = ?,
         owner_earning    = ?,
         courier_earning  = ?,
         total_amount     = ?,
         status           = 'processing',
         updated_at       = NOW()
       WHERE order_id = ?`,
      [wKg, service_fee, delivery_fee, distance_km, admin_commission, owner_earning, courier_earning, total_amount, order_id]
    );

    // 5. Update invoice
    await db.query(
      `UPDATE invoices SET amount = ?, service_fee = ?, delivery_fee = ?, updated_at = NOW()
       WHERE order_id = ?`,
      [total_amount, service_fee, delivery_fee, order_id]
    );

    // 6. Kirim notifikasi ke customer
    await db.query(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [
        order.customer_id,
        'Invoice Tersedia',
        `Laundry Anda sudah ditimbang (${wKg} kg). Total tagihan: Rp ${total_amount.toLocaleString('id-ID')}. Silakan lakukan pembayaran.`,
      ]
    );

    return res.status(200).json({
      message: 'Berat berhasil diinput. Invoice diperbarui, status order: processing.',
      data: {
        order_id,
        weight_kg:        wKg,
        distance_km,
        service_fee,
        delivery_fee,
        admin_commission,
        owner_earning,
        courier_earning,
        total_amount,
        status: 'processing',
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── GET /orders/my-orders ─────────────────────────────────────────────────
const getMyOrders = async (req, res) => {
  const customer_id = req.user.user_id;
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query  = 'SELECT * FROM orders WHERE customer_id = ?';
    let params = [customer_id];

    if (status) { query += ' AND status = ?'; params.push(status); }

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

// ── GET /orders/:order_id ─────────────────────────────────────────────────
const getOrderDetail = async (req, res) => {
  const { order_id } = req.params;
  const user = req.user;

  try {
    const [orders] = await db.query(
      `SELECT
         o.*,
         s.name         AS service_name,
         s.price_per_kg,
         i.invoice_id,
         i.amount,
         i.service_fee  AS inv_service_fee,
         i.delivery_fee AS inv_delivery_fee,
         i.status       AS payment_status,
         ca.assignment_id,
         ca.courier_id,
         ca.task_type,
         ca.status      AS courier_task_status
       FROM orders o
       LEFT JOIN services s             ON o.service_id   = s.service_id
       LEFT JOIN invoices i             ON o.order_id     = i.order_id
       LEFT JOIN courier_assignments ca ON o.order_id     = ca.order_id
       WHERE o.order_id = ?`,
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
    }

    const order = orders[0];
    if (user.role === 'customer' && order.customer_id !== user.user_id) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }

    return res.status(200).json({ message: 'Success', data: order });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── PATCH /orders/:order_id/status ────────────────────────────────────────
// Owner update status order
const updateOrderStatus = async (req, res) => {
  const { order_id } = req.params;
  const { status }   = req.body;

  const validStatuses = ['pending','confirmed','picked_up','processing','ready','delivered','cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Status tidak valid. Pilih: ${validStatuses.join(', ')}` });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
    }

    await db.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?', [status, order_id]);

    await db.query(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [orders[0].customer_id, 'Status Pesanan Diperbarui', `Pesanan ${order_id} sekarang berstatus: ${status}`]
    );

    return res.status(200).json({ message: 'Status pesanan berhasil diperbarui.', data: { order_id, status } });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── POST /orders/:order_id/assign-courier ────────────────────────────────
// Owner tugaskan 1 kurir untuk seluruh order (pickup & delivery)
const assignCourier = async (req, res) => {
  const { order_id }  = req.params;
  const { courier_id } = req.body;

  if (!courier_id) {
    return res.status(400).json({ message: 'courier_id wajib diisi.' });
  }

  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
    }

    const [couriers] = await db.query(
      'SELECT * FROM users WHERE user_id = ? AND role = "courier" AND is_verified = 1',
      [courier_id]
    );
    if (couriers.length === 0) {
      return res.status(404).json({ message: 'Kurir tidak ditemukan atau belum terverifikasi.' });
    }

    // Cek apakah sudah ada assignment untuk order ini
    const [existing] = await db.query(
      'SELECT * FROM courier_assignments WHERE order_id = ?',
      [order_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Order ini sudah memiliki kurir. 1 order hanya boleh 1 kurir.',
        data: existing[0],
      });
    }

    const assignment_id = `ASG${Date.now()}`;
    await db.query(
      `INSERT INTO courier_assignments (assignment_id, order_id, courier_id, task_type, status)
       VALUES (?, ?, ?, 'pickup', 'assigned')`,
      [assignment_id, order_id, courier_id]
    );

    // Notifikasi ke kurir
    await db.query(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [courier_id, 'Tugas Baru', `Anda ditugaskan untuk order ${order_id}. Fase saat ini: PICKUP`]
    );

    return res.status(201).json({
      message: 'Kurir berhasil ditugaskan. Kurir yang sama akan handle pickup & delivery.',
      data: { assignment_id, order_id, courier_id, task_type: 'pickup', status: 'assigned' },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── PATCH /orders/:order_id/courier-phase ────────────────────────────────
// Owner switch fase kurir dari pickup → delivery (setelah laundry selesai)
const switchCourierPhase = async (req, res) => {
  const { order_id } = req.params;

  try {
    const [assignments] = await db.query(
      'SELECT * FROM courier_assignments WHERE order_id = ?',
      [order_id]
    );
    if (assignments.length === 0) {
      return res.status(404).json({ message: 'Assignment kurir tidak ditemukan.' });
    }

    const asg = assignments[0];
    if (asg.task_type !== 'pickup') {
      return res.status(400).json({ message: `Fase sudah: ${asg.task_type}. Tidak bisa di-switch lagi.` });
    }

    await db.query(
      `UPDATE courier_assignments SET task_type = 'delivery', status = 'assigned', updated_at = NOW()
       WHERE assignment_id = ?`,
      [asg.assignment_id]
    );

    // Notifikasi ke kurir
    await db.query(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [asg.courier_id, 'Fase Baru: DELIVERY', `Laundry order ${order_id} sudah selesai. Silakan antar ke customer.`]
    );

    return res.status(200).json({
      message: 'Fase kurir berhasil diubah ke DELIVERY.',
      data: { assignment_id: asg.assignment_id, order_id, task_type: 'delivery', status: 'assigned' },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── GET /orders/:order_id/tracking ───────────────────────────────────────
const trackOrder = async (req, res) => {
  const { order_id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT
         ca.assignment_id,
         ca.task_type,
         ca.status       AS task_status,
         u.user_id       AS courier_id,
         u.full_name     AS courier_name,
         u.vehicle_name,
         u.vehicle_plate_number,
         cl.lat,
         cl.lng,
         cl.updated_at   AS location_updated_at
       FROM courier_assignments ca
       JOIN users u              ON ca.courier_id    = u.user_id
       LEFT JOIN courier_locations cl ON ca.assignment_id = cl.assignment_id
       WHERE ca.order_id = ?
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
        courier: {
          courier_id:           r.courier_id,
          name:                 r.courier_name,
          vehicle_name:         r.vehicle_name,
          vehicle_plate_number: r.vehicle_plate_number,
        },
        current_phase: r.task_type,
        task_status:   r.task_status,
        location:      { lat: r.lat, lng: r.lng },
        location_updated_at: r.location_updated_at,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── POST /orders/:order_id/ratings ───────────────────────────────────────
const rateOrder = async (req, res) => {
  const { order_id }   = req.params;
  const { rating, review } = req.body;
  const customer_id    = req.user.user_id;

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

// ── GET /orders (owner — semua order) ────────────────────────────────────
const getAllOrders = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query  = `SELECT o.*, s.name AS service_name, u.full_name AS customer_name
                  FROM orders o
                  JOIN services s ON o.service_id  = s.service_id
                  JOIN users u    ON o.customer_id = u.user_id`;
    let params = [];

    if (status) { query += ' WHERE o.status = ?'; params.push(status); }
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [orders] = await db.query(query, params);
    return res.status(200).json({ message: 'Success', data: orders });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = {
  createOrder,
  inputWeight,
  getMyOrders,
  getOrderDetail,
  updateOrderStatus,
  assignCourier,
  switchCourierPhase,
  trackOrder,
  rateOrder,
  getAllOrders,
};

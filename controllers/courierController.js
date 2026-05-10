const db = require('../config/db');

// ── PATCH /couriers/me/location ───────────────────────────────────────────
// Kurir update lokasi GPS
const updateLocation = async (req, res) => {
  const { lat, lng, assignment_id } = req.body;
  const courier_id = req.user.user_id;

  if (!lat || !lng || !assignment_id) {
    return res.status(400).json({ message: 'lat, lng, dan assignment_id wajib diisi.' });
  }

  try {
    const [asgn] = await db.query(
      'SELECT * FROM courier_assignments WHERE assignment_id = ? AND courier_id = ?',
      [assignment_id, courier_id]
    );
    if (asgn.length === 0) {
      return res.status(404).json({ message: 'Assignment tidak ditemukan.' });
    }

    await db.query(
      `INSERT INTO courier_locations (courier_id, assignment_id, lat, lng, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), updated_at = NOW()`,
      [courier_id, assignment_id, lat, lng]
    );

    return res.status(200).json({
      message: 'Lokasi berhasil diperbarui.',
      data: { assignment_id, lat, lng, current_phase: asgn[0].task_type },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── PATCH /couriers/tasks/:assignment_id/status ───────────────────────────
// Kurir update status tugasnya (berlaku untuk fase pickup maupun delivery)
const updateTaskStatus = async (req, res) => {
  const { assignment_id } = req.params;
  const { status }        = req.body;
  const courier_id        = req.user.user_id;

  const validStatuses = ['assigned', 'on_the_way', 'arrived', 'picked_up', 'delivered', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Status tidak valid. Pilih: ${validStatuses.join(', ')}` });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM courier_assignments WHERE assignment_id = ? AND courier_id = ?',
      [assignment_id, courier_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Assignment tidak ditemukan.' });
    }

    await db.query(
      'UPDATE courier_assignments SET status = ?, updated_at = NOW() WHERE assignment_id = ?',
      [status, assignment_id]
    );

    // Jika kurir selesai delivery, otomatis update order menjadi delivered
    if (status === 'done' && rows[0].task_type === 'delivery') {
      await db.query(
        `UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE order_id = ?`,
        [rows[0].order_id]
      );

      // Ambil customer_id dari order
      const [orders] = await db.query('SELECT customer_id FROM orders WHERE order_id = ?', [rows[0].order_id]);
      if (orders.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
          [orders[0].customer_id, 'Laundry Tiba!', `Order ${rows[0].order_id} telah diantar. Silakan beri rating!`]
        );
      }
    }

    return res.status(200).json({
      message: 'Status tugas berhasil diperbarui.',
      data: { assignment_id, status, phase: rows[0].task_type },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── GET /couriers/me/tasks ────────────────────────────────────────────────
// Daftar tugas aktif kurir (termasuk info fase saat ini)
const getMyTasks = async (req, res) => {
  const courier_id = req.user.user_id;

  try {
    const [tasks] = await db.query(
      `SELECT
         ca.assignment_id,
         ca.order_id,
         ca.task_type       AS current_phase,
         ca.status          AS task_status,
         o.pickup_address,
         o.pickup_lat,
         o.pickup_lng,
         o.pickup_scheduled_at,
         o.status           AS order_status,
         o.weight_kg,
         o.total_amount,
         u.full_name        AS customer_name,
         u.address          AS customer_address,
         u.lat              AS customer_lat,
         u.lng              AS customer_lng
       FROM courier_assignments ca
       JOIN orders o ON ca.order_id   = o.order_id
       JOIN users  u ON o.customer_id = u.user_id
       WHERE ca.courier_id = ? AND ca.status NOT IN ('done', 'cancelled')
       ORDER BY ca.created_at DESC`,
      [courier_id]
    );
    return res.status(200).json({ message: 'Success', data: tasks });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ── GET /couriers/me/tasks/history ───────────────────────────────────────
const getTaskHistory = async (req, res) => {
  const courier_id = req.user.user_id;

  try {
    const [tasks] = await db.query(
      `SELECT
         ca.assignment_id,
         ca.order_id,
         ca.task_type   AS last_phase,
         ca.status      AS task_status,
         o.pickup_address,
         o.pickup_scheduled_at,
         o.weight_kg,
         o.total_amount,
         o.courier_earning,
         u.full_name    AS customer_name
       FROM courier_assignments ca
       JOIN orders o ON ca.order_id   = o.order_id
       JOIN users  u ON o.customer_id = u.user_id
       WHERE ca.courier_id = ? AND ca.status IN ('done', 'cancelled')
       ORDER BY ca.updated_at DESC`,
      [courier_id]
    );
    return res.status(200).json({ message: 'Success', data: tasks });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { updateLocation, updateTaskStatus, getMyTasks, getTaskHistory };

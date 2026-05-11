const db = require('../config/db');

// PATCH /couriers/me/location — Update lokasi kurir
const updateLocation = async (req, res) => {
  const { lat, lng, assignment_id } = req.body;
  const courier_id = req.user.user_id;

  if (!lat || !lng || !assignment_id) {
    return res.status(400).json({ message: 'lat, lng, dan assignment_id wajib diisi.' });
  }

  try {
    // Validasi assignment milik kurir ini
    const [asgn] = await db.query(
      'SELECT * FROM courier_assignments WHERE assignment_id = ? AND courier_id = ?',
      [assignment_id, courier_id]
    );
    if (asgn.length === 0) {
      return res.status(404).json({ message: 'Assignment tidak ditemukan.' });
    }

    // Upsert lokasi
    await db.query(
      `INSERT INTO courier_locations (courier_id, assignment_id, lat, lng, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), updated_at = NOW()`,
      [courier_id, assignment_id, lat, lng]
    );

    return res.status(200).json({ message: 'Lokasi berhasil diperbarui.', data: { lat, lng, assignment_id } });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH /couriers/tasks/:assignment_id/status — Update status tugas kurir
const updateTaskStatus = async (req, res) => {
  const { assignment_id } = req.params;
  const { status } = req.body;
  const courier_id = req.user.user_id;

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

    return res.status(200).json({ message: 'Status tugas berhasil diperbarui.', data: { assignment_id, status } });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /couriers/me/tasks — Daftar tugas aktif kurir
const getMyTasks = async (req, res) => {
  const courier_id = req.user.user_id;

  try {
    const [tasks] = await db.query(
      `SELECT ca.*, o.pickup_address, o.pickup_scheduled_at, o.status AS order_status,
              u.full_name AS customer_name
       FROM courier_assignments ca
       JOIN orders o ON ca.order_id = o.order_id
       JOIN users u ON o.customer_id = u.user_id
       WHERE ca.courier_id = ? AND ca.status NOT IN ('done', 'cancelled')
       ORDER BY ca.created_at DESC`,
      [courier_id]
    );
    return res.status(200).json({ message: 'Success', data: tasks });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /couriers/me/tasks/history — Riwayat pekerjaan kurir
const getTaskHistory = async (req, res) => {
  const courier_id = req.user.user_id;

  try {
    const [tasks] = await db.query(
      `SELECT ca.*, o.pickup_address, o.pickup_scheduled_at,
              u.full_name AS customer_name
       FROM courier_assignments ca
       JOIN orders o ON ca.order_id = o.order_id
       JOIN users u ON o.customer_id = u.user_id
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

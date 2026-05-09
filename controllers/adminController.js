const db = require('../config/db');

// GET /admin/dashboard/metrics — Statistik dashboard admin
const getDashboardMetrics = async (req, res) => {
  try {
    const [[totalOrders]]      = await db.query('SELECT COUNT(*) AS total FROM orders');
    const [[pendingOrders]]    = await db.query('SELECT COUNT(*) AS total FROM orders WHERE status = "pending"');
    const [[deliveredOrders]]  = await db.query('SELECT COUNT(*) AS total FROM orders WHERE status = "delivered"');
    const [[totalRevenue]]     = await db.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'success'`);
    const [[totalCustomers]]   = await db.query('SELECT COUNT(*) AS total FROM users WHERE role = "customer"');
    const [[totalCouriers]]    = await db.query('SELECT COUNT(*) AS total FROM users WHERE role = "courier"');
    const [[pendingUsers]]     = await db.query('SELECT COUNT(*) AS total FROM users WHERE is_verified = 0 AND role != "customer"');

    return res.status(200).json({
      message: 'Success',
      data: {
        orders: {
          total:     totalOrders.total,
          pending:   pendingOrders.total,
          delivered: deliveredOrders.total,
        },
        revenue:       totalRevenue.total,
        users: {
          customers:     totalCustomers.total,
          couriers:      totalCouriers.total,
          pending_verify: pendingUsers.total,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH /admin/users/:user_id/verify — Verifikasi owner atau kurir
const verifyUser = async (req, res) => {
  const { user_id } = req.params;
  const { is_verified } = req.body;

  if (typeof is_verified !== 'boolean') {
    return res.status(400).json({ message: 'is_verified harus boolean (true/false).' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    const user = users[0];
    if (user.role === 'customer') {
      return res.status(400).json({ message: 'Customer tidak perlu diverifikasi.' });
    }

    await db.query('UPDATE users SET is_verified = ? WHERE user_id = ?', [is_verified ? 1 : 0, user_id]);

    // Notifikasi ke user
    const statusText = is_verified ? 'diverifikasi' : 'tidak diverifikasi';
    await db.query(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [user_id, 'Status Verifikasi', `Akun Anda telah ${statusText} oleh admin.`]
    );

    return res.status(200).json({
      message: `User berhasil ${statusText}.`,
      data: { user_id, is_verified },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { getDashboardMetrics, verifyUser };

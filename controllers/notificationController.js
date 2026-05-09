const db = require('../config/db');

// GET /notifications — Daftar notifikasi user
const getNotifications = async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const [notifications] = await db.query(
      `SELECT notification_id, title, message, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
      [user_id]
    );
    return res.status(200).json({ message: 'Success', data: notifications });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH /notifications/:notification_id/read — Tandai sudah dibaca
const markAsRead = async (req, res) => {
  const { notification_id } = req.params;
  const user_id = req.user.user_id;

  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE notification_id = ? AND user_id = ?',
      [notification_id, user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Notifikasi tidak ditemukan.' });
    }

    await db.query('UPDATE notifications SET is_read = 1 WHERE notification_id = ?', [notification_id]);
    return res.status(200).json({ message: 'Notifikasi ditandai sudah dibaca.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { getNotifications, markAsRead };

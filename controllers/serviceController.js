const db = require('../config/db');

// GET /services — Daftar semua layanan laundry
const getAllServices = async (req, res) => {
  try {
    const [services] = await db.query('SELECT * FROM services WHERE is_active = 1 ORDER BY name ASC');
    return res.status(200).json({ message: 'Success', data: services });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /services/:service_id — Detail layanan
const getServiceDetail = async (req, res) => {
  const { service_id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM services WHERE service_id = ?', [service_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    }
    return res.status(200).json({ message: 'Success', data: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { getAllServices, getServiceDetail };

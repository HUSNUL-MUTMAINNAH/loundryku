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

// POST /services — Tambah layanan baru (owner)
const createService = async (req, res) => {
  const { service_id, name, description, price_per_kg } = req.body;

  if (!service_id || !name || !price_per_kg) {
    return res.status(400).json({ message: 'service_id, name, dan price_per_kg wajib diisi.' });
  }

  try {
    const [existing] = await db.query('SELECT service_id FROM services WHERE service_id = ?', [service_id]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'service_id sudah digunakan.' });
    }

    await db.query(
      'INSERT INTO services (service_id, name, description, price_per_kg) VALUES (?, ?, ?, ?)',
      [service_id, name, description || null, price_per_kg]
    );

    return res.status(201).json({
      message: 'Layanan berhasil ditambahkan.',
      data: { service_id, name, description, price_per_kg, is_active: 1 },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH /services/:service_id — Update layanan (owner)
const updateService = async (req, res) => {
  const { service_id } = req.params;
  const { name, description, price_per_kg, is_active } = req.body;

  const fields = [];
  const values = [];

  if (name        !== undefined) { fields.push('name = ?');        values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (price_per_kg!== undefined) { fields.push('price_per_kg = ?');values.push(price_per_kg); }
  if (is_active   !== undefined) { fields.push('is_active = ?');   values.push(is_active ? 1 : 0); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'Tidak ada field yang diperbarui.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM services WHERE service_id = ?', [service_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    }

    values.push(service_id);
    await db.query(`UPDATE services SET ${fields.join(', ')} WHERE service_id = ?`, values);

    const [updated] = await db.query('SELECT * FROM services WHERE service_id = ?', [service_id]);
    return res.status(200).json({ message: 'Layanan berhasil diperbarui.', data: updated[0] });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// DELETE /services/:service_id — Hapus layanan (soft delete, owner)
const deleteService = async (req, res) => {
  const { service_id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM services WHERE service_id = ?', [service_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    }

    // Soft delete: nonaktifkan saja agar tidak merusak data order lama
    await db.query('UPDATE services SET is_active = 0 WHERE service_id = ?', [service_id]);

    return res.status(200).json({ message: 'Layanan berhasil dihapus.', data: { service_id } });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { getAllServices, getServiceDetail, createService, updateService, deleteService };
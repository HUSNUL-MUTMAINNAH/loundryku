const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const db       = require('../config/db');

const JWT_SECRET  = process.env.JWT_SECRET  || 'secret_key';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// POST /auth/register
const register = async (req, res) => {
  const { full_name, email, password, role } = req.body;

  const allowedRoles = ['customer', 'courier', 'owner'];
  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ message: 'Semua field wajib diisi.' });
  }
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: `Role tidak valid. Pilih: ${allowedRoles.join(', ')}` });
  }

  try {
    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email sudah terdaftar.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [full_name, email, hashed, role]
    );

    return res.status(201).json({
      message: 'Registrasi berhasil.',
      data: { user_id: result.insertId, full_name, email, role },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    // Simpan token ke tabel sessions (opsional untuk blacklist logout)
    await db.query('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.user_id, token]);

    return res.status(200).json({
      message: 'Login berhasil.',
      data: {
        token,
        user: { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /auth/profile
const getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT user_id, full_name, email, role, is_verified, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }
    return res.status(200).json({ message: 'Success', data: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /auth/logout
const logout = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  try {
    // Hapus token dari tabel sessions
    await db.query('DELETE FROM sessions WHERE token = ?', [token]);
    return res.status(200).json({ message: 'Logout berhasil.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// PATCH /auth/profile — Update profil sendiri
const updateProfile = async (req, res) => {
  const { full_name, email, password } = req.body;
  const user_id = req.user.user_id;

  const fields = [];
  const values = [];

  if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }

  if (email !== undefined) {
    // Cek email sudah dipakai user lain
    const [existing] = await db.query(
      'SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, user_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email sudah digunakan akun lain.' });
    }
    fields.push('email = ?');
    values.push(email);
  }

  if (password !== undefined) {
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password minimal 6 karakter.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    fields.push('password = ?');
    values.push(hashed);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'Tidak ada field yang diperbarui.' });
  }

  try {
    values.push(user_id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, values);

    const [rows] = await db.query(
      'SELECT user_id, full_name, email, role, is_verified, created_at FROM users WHERE user_id = ?',
      [user_id]
    );
    return res.status(200).json({ message: 'Profil berhasil diperbarui.', data: rows[0] });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { register, login, getProfile, logout, updateProfile };
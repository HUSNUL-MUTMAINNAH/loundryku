const db = require('../config/db');

// POST /payments — Bayar invoice
const createPayment = async (req, res) => {
  const { invoice_id, payment_method } = req.body;
  const user_id = req.user.user_id;

  if (!invoice_id || !payment_method) {
    return res.status(400).json({ message: 'invoice_id dan payment_method wajib diisi.' });
  }

  const validMethods = ['virtual_account', 'transfer', 'cash', 'e_wallet'];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({ message: `Metode tidak valid. Pilih: ${validMethods.join(', ')}` });
  }

  try {
    const [invoices] = await db.query(
      `SELECT i.*, o.customer_id FROM invoices i JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_id = ?`,
      [invoice_id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan.' });
    }

    const invoice = invoices[0];
    if (invoice.customer_id !== user_id) {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    if (invoice.status === 'paid') {
      return res.status(409).json({ message: 'Invoice sudah dibayar.' });
    }

    const payment_id  = `PAY${Date.now()}`;
    const va_number   = payment_method === 'virtual_account' ? `88008${Math.floor(Math.random() * 1e10)}` : null;
    const expired_at  = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    await db.query(
      `INSERT INTO payments (payment_id, invoice_id, user_id, payment_method, amount, status, va_number, expired_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [payment_id, invoice_id, user_id, payment_method, invoice.amount, va_number, expired_at]
    );

    return res.status(201).json({
      message: 'Pembayaran berhasil dibuat. Selesaikan pembayaran sebelum expired.',
      data: { payment_id, invoice_id, payment_method, amount: invoice.amount, va_number, expired_at },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /payments/callback — Callback dari payment gateway
const paymentCallback = async (req, res) => {
  const { payment_id, status } = req.body;

  try {
    const [payments] = await db.query('SELECT * FROM payments WHERE payment_id = ?', [payment_id]);
    if (payments.length === 0) {
      return res.status(404).json({ message: 'Pembayaran tidak ditemukan.' });
    }

    const payment = payments[0];

    if (status === 'success') {
      await db.query('UPDATE payments SET status = "success", paid_at = NOW() WHERE payment_id = ?', [payment_id]);
      await db.query('UPDATE invoices SET status = "paid" WHERE invoice_id = ?', [payment.invoice_id]);

      // Notifikasi ke customer
      const [invoices] = await db.query(
        `SELECT o.customer_id, o.order_id FROM invoices i JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_id = ?`,
        [payment.invoice_id]
      );
      if (invoices.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
          [invoices[0].customer_id, 'Pembayaran Berhasil',
           `Pembayaran untuk order ${invoices[0].order_id} berhasil`]
        );
      }
    } else {
      await db.query('UPDATE payments SET status = "failed" WHERE payment_id = ?', [payment_id]);
    }

    return res.status(200).json({ message: 'Callback diproses.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { createPayment, paymentCallback };

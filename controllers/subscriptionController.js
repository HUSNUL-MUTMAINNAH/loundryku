const db = require('../config/db');

// GET /subscriptions/plans — Lihat paket subscription
const getPlans = async (req, res) => {
  try {
    const [plans] = await db.query('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price ASC');
    return res.status(200).json({ message: 'Success', data: plans });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /subscriptions — Beli paket subscription
const buySubscription = async (req, res) => {
  const { plan_id, auto_renew } = req.body;
  const user_id = req.user.user_id;

  if (!plan_id) {
    return res.status(400).json({ message: 'plan_id wajib diisi.' });
  }

  try {
    const [plans] = await db.query('SELECT * FROM subscription_plans WHERE plan_id = ? AND is_active = 1', [plan_id]);
    if (plans.length === 0) {
      return res.status(404).json({ message: 'Paket tidak ditemukan.' });
    }

    const plan = plans[0];

    // Hitung tanggal mulai & berakhir
    const started_at = new Date();
    const expired_at = new Date(started_at);
    if (plan.period_type === 'weekly')  expired_at.setDate(expired_at.getDate() + 7);
    if (plan.period_type === 'monthly') expired_at.setMonth(expired_at.getMonth() + 1);

    const subscription_id = `SUB${Date.now()}`;
    await db.query(
      `INSERT INTO user_subscriptions (subscription_id, user_id, plan_id, started_at, expired_at, auto_renew, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [subscription_id, user_id, plan_id, started_at, expired_at, auto_renew ? 1 : 0]
    );

    return res.status(201).json({
      message: 'Paket berhasil dibeli.',
      data: { subscription_id, plan_id, plan_name: plan.name, started_at, expired_at, auto_renew },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { getPlans, buySubscription };

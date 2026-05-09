require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Routes
const authRoutes         = require('./routes/authRoutes');
const orderRoutes        = require('./routes/orderRoutes');
const serviceRoutes      = require('./routes/serviceRoutes');
const paymentRoutes      = require('./routes/paymentRoutes');
const courierRoutes      = require('./routes/courierRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes        = require('./routes/adminRoutes');

app.use('/auth',          authRoutes);
app.use('/orders',        orderRoutes);
app.use('/services',      serviceRoutes);
app.use('/payments',      paymentRoutes);
app.use('/couriers',      courierRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin',         adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));

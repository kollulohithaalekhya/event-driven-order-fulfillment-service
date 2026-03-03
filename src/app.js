require('dotenv').config();
const express = require('express');
const sequelize = require('./config/db');
const { connectRabbitMQ } = require('./rabbitmq/connection');
const { setupRabbitMQ } = require('./rabbitmq/setup');
const orderRoutes = require('./routes/order.routes');
const app = express();
app.use(express.json());

app.use('/orders', orderRoutes);
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

const PORT = process.env.PORT || 8080;
async function connectWithRetry(retries = 10, delay = 3000) {
  while (retries) {
    try {
      await sequelize.authenticate();
      console.log("Database connected.");
      return;
    } catch (err) {
      console.log(`DB not ready. Retrying in ${delay / 1000}s...`);
      retries -= 1;
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Could not connect to DB after multiple attempts.");
}

async function startServer() {
  try {
    // 1️⃣ Connect DB with retry
    await connectWithRetry();
    await sequelize.sync();
    console.log("Database synced.");

    // 2️⃣ Connect RabbitMQ
    await connectRabbitMQ();
    console.log("RabbitMQ connected.");

    // 3️⃣ Setup Exchange + Queue
    await setupRabbitMQ();
    console.log("RabbitMQ setup completed.");

    // 4️⃣ Start HTTP Server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}
startServer();
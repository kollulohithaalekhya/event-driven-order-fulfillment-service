require('dotenv').config();
const sequelize = require('../config/db');
const Order = require('../models/order.model');
const { connectRabbitMQ, getChannel } = require('../rabbitmq/connection');

async function startConsumer() {
  try {

    // ✅ DB retry
    async function connectWithRetry(retries = 10, delay = 3000) {
      while (retries) {
        try {
          await sequelize.authenticate();
          console.log("Worker DB connected.");
          return;
        } catch (err) {
          console.log("Worker DB not ready. Retrying in 3s...");
          retries--;
          await new Promise(res => setTimeout(res, delay));
        }
      }
      throw new Error("Worker could not connect to DB.");
    }

    await connectWithRetry();

    await connectRabbitMQ();
    const channel = getChannel();

    // ✅ FULL RABBITMQ SETUP (Important)
    const exchange = 'order.exchange';
    const dlxExchange = 'dlx.order.exchange';
    const queue = 'order.created.queue';
    const dlq = 'order.dlq';

    // main exchange
    await channel.assertExchange(exchange, 'topic', { durable: true });

    // dead letter exchange
    await channel.assertExchange(dlxExchange, 'direct', { durable: true });

    // DLQ
    await channel.assertQueue(dlq, { durable: true });
    await channel.bindQueue(dlq, dlxExchange, 'order.dead');

    // main queue with DLX
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlxExchange,
        'x-dead-letter-routing-key': 'order.dead'
      }
    });

    await channel.bindQueue(queue, exchange, 'order.created');

    console.log("Worker waiting for messages...");

    // ✅ Consume
    channel.consume(queue, async (msg) => {
        if (!msg) return;

        try {
            const data = JSON.parse(msg.content.toString());
            console.log("Received order:", data);

            // 🔥 FORCE FAILURE TEST
            if (data.productId === "999") {
            throw new Error("Simulated failure");
            }

            const order = await Order.findByPk(data.orderId);

            if (!order) {
            console.log("Order not found. Sending to DLQ.");
            return channel.nack(msg, false, false);
            }

            if (order.status === 'PROCESSED') {
            console.log("Order already processed. Skipping:", order.id);
            return channel.ack(msg);
            }

            order.status = 'PROCESSING';
            await order.save();

            await new Promise(res => setTimeout(res, 2000));

            order.status = 'PROCESSED';
            await order.save();

            console.log("Order processed:", order.id);

            channel.ack(msg);

        } catch (err) {
            console.error("Processing failed:", err.message);

            const headers = msg.properties.headers || {};
            const retryCount = headers['x-retry-count'] || 0;

            if (retryCount >= 3) {
            console.log("Max retries reached. Sending to DLQ.");
            return channel.nack(msg, false, false);
            }

            console.log(`Retrying message. Attempt ${retryCount + 1}`);

            setTimeout(() => {
            channel.publish(
                'order.exchange',
                'order.created',
                msg.content,
                {
                headers: { 'x-retry-count': retryCount + 1 },
                persistent: true
                }
            );
            }, 5000);

            channel.ack(msg);
        }
        });

  } catch (error) {
    console.error("Worker failed:", error);
    process.exit(1);
  }
}

startConsumer();
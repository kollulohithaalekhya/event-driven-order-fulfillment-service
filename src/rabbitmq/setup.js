const { getChannel } = require('./connection');

async function setupRabbitMQ() {
  const channel = getChannel();

  const exchange = 'order.exchange';
  const retryExchange = 'retry.order.exchange';
  const dlxExchange = 'dlx.order.exchange';

  const queue = 'order.created.queue';
  const retryQueue = 'order.retry.queue';
  const dlq = 'order.dlq';

  // Exchanges
  await channel.assertExchange(exchange, 'topic', { durable: true });
  await channel.assertExchange(retryExchange, 'direct', { durable: true });
  await channel.assertExchange(dlxExchange, 'direct', { durable: true });

  // DLQ
  await channel.assertQueue(dlq, { durable: true });
  await channel.bindQueue(dlq, dlxExchange, 'order.dead');

  // Retry queue (5s delay)
  await channel.assertQueue(retryQueue, {
    durable: true,
    arguments: {
      'x-message-ttl': 5000, // 5 seconds delay
      'x-dead-letter-exchange': exchange,
      'x-dead-letter-routing-key': 'order.created'
    }
  });

  await channel.bindQueue(retryQueue, retryExchange, 'order.retry');

  // Main queue
  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': dlxExchange,
      'x-dead-letter-routing-key': 'order.dead'
    }
  });

  await channel.bindQueue(queue, exchange, 'order.created');

  console.log("RabbitMQ setup with Retry + DLQ completed.");
}

module.exports = { setupRabbitMQ };
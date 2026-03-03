const { getChannel } = require('../rabbitmq/connection');

const EXCHANGE = 'order.exchange';
const ROUTING_KEY = 'order.created';

async function publishOrderCreated(order) {
  const channel = getChannel();

  const message = {
    orderId: order.id,
    productId: order.productId,
    customerId: order.customerId,
    quantity: order.quantity,
  };

  const published = channel.publish(
    EXCHANGE,
    ROUTING_KEY,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      contentType: 'application/json',
    }
  );

  if (!published) {
    throw new Error("Failed to publish message");
  }

  console.log("Order event published:", order.id);
}

module.exports = {
  publishOrderCreated,
};
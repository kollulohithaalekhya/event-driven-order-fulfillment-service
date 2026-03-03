const Order = require('../models/order.model');
const { publishOrderCreated } = require('../publishers/order.publisher.js');

async function createOrder(data) {
  const order = await Order.create({
    productId: data.productId,
    customerId: data.customerId,
    quantity: data.quantity,
    status: 'PENDING'
  });

  await publishOrderCreated(order);

  return order;
}

module.exports = {
  createOrder,
};
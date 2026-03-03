const amqp = require('amqplib');

let channel = null;

async function connectRabbitMQ() {
  const connection = await amqp.connect({
    protocol: 'amqp',
    hostname: process.env.RABBITMQ_HOST,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USER,
    password: process.env.RABBITMQ_PASSWORD,
  });

  channel = await connection.createChannel();
  console.log("RabbitMQ connected.");
}

function getChannel() {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized.");
  }
  return channel;
}

module.exports = {
  connectRabbitMQ,
  getChannel,
};
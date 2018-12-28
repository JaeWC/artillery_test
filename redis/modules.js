const redis = require('redis');

const client = redis.createClient(6379, 'localhost');
client.on('connect', () => console.log('Redis Connected'));

const writeMessage = (message, key, hashKey) =>
  client.hget(key, hashKey, (err, reply) => {
    if (err) {
      console.log(err);
      return;
    }

    let chattingList;
    reply === null ? (chattingList = []) : (chattingList = JSON.parse(reply));

    chattingList.unshift(message);

    client.hmset(key, hashKey, JSON.stringify(chattingList));
  });

const writePosition = async (position, key, hashKey) => {
  await client.hmset(key, hashKey, JSON.stringify(position));
};

const deleteHashKey = (key, hashKey) => client.hdel(key, hashKey);

module.exports = {
  writeMessage,
  writePosition,
  deleteHashKey
};

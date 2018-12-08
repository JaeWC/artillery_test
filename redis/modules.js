const redis = require('redis');

const client = redis.createClient(6379, 'localhost');

client.on('connect', () => console.log('Redis Connected'));

const createRoom = async (key, hashKey, hashValue) =>
  await client.hmset(key, hashKey, hashValue);

const expireRoom = async (key, duration) => await client.expire(key, duration);

const writeMessage = (message, key, hashKey) =>
  client.hget(key, hashKey, (err, reply) => {
    if (err) {
      console.log(err);
      return;
    }

    let chattingList;
    reply === null ? (chattingList = []) : (chattingList = JSON.parse(reply));
    chattingList.push(message);

    client.hmset(key, hashKey, JSON.stringify(chattingList));
  });

const writePosition = async (position, key, hashKey) =>
  await client.hmset(key, hashKey, JSON.stringify(position));

const readMessage = async (res, key, hashKey) =>
  await client.hget(key, hashKey, (err, reply) => {
    if (err) {
      console.log(err);
      return;
    }

    if (reply === null) {
      res.json([]);
    } else {
      let chatting = JSON.parse(reply);
      res.json(chatting);
    }
  });

const readPosition = async (res, key) =>
  await client.hgetall(key, (err, reply) => {
    if (err) {
      console.log(err);
      return;
    }

    let userPosition = {};
    if (reply) {
      const resultKeys = Object.keys(reply);

      userPosition = {};
      resultKeys.forEach(
        user => (userPosition[user] = JSON.parse(reply[user]))
      );
    }
    res.json(userPosition);
  });

const deleteHashKey = (key, hashKey) => client.hdel(key, hashKey);

module.exports = {
  createRoom,
  expireRoom,
  writeMessage,
  readMessage,
  writePosition,
  readPosition,
  deleteHashKey
};

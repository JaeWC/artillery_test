const socketio = require('socket.io');

const redis = require('redis');
const redisAdapter = require('socket.io-redis');

const pub = redis.createClient();
const sub = redis.createClient();
sub.subscribe('chat');

const {
  writeMessage,
  writePosition,
  deleteHashKey
} = require('../redis/modules');

module.exports.listen = app => {
  io = socketio.listen(app, {
    transports: ['websocket', 'polling']
  });
  io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));

  sub.on('subscribe', (channel, count) => {
    console.log('Subscribe count is :::::: ', count);
  });

  io.on('connection', socket => {
    io.clients((error, clients) => {
      if (error) throw error;
      console.log('socket clients :::::: ', clients);
    });

    // join chatting room
    socket.on('join', function(data) {
      console.log('Join :::::: ', data);

      socket.userInfo = { roomCode: data.roomCode, userId: data.userId };

      const myPosition = {};
      myPosition.longitude = data.position.longitude;
      myPosition.latitude = data.position.latitude;
      myPosition.timestamp = data.position.timestamp;
      myPosition.userId = data.userId;
      myPosition.thumbnail = data.thumbnail;
      writePosition(myPosition, data.roomCode, data.userId);

      const joinMessage = {};
      joinMessage.userId = data.userId;
      joinMessage.position = myPosition;

      const pubMessage = {};
      pubMessage.type = 'joinRoom';
      pubMessage.roomCode = data.roomCode;
      pubMessage.client = socket.id;

      const message = JSON.stringify({
        redis: pubMessage,
        socket: joinMessage
      });

      socket.join(data.roomCode);
      pub.publish('chat', message, () => console.log('Pub Join Complete'));
    });

    // leave chatting room
    socket.on('leave', function(data) {
      socket.leave(data.roomCode, () => {
        socket.disconnect();
        console.log('Leave :::::: ', data);

        deleteHashKey(data.roomCode, data.userId);
        leaveRoom(data.roomCode, data.userId);
      });
    });

    socket.on('disconnect', async data => {
      let userInfo = await socket.userInfo;
      console.log('Disconnect :::::: ', userInfo);
    });

    // send message to selected room members
    socket.on('message', async data => {
      console.log('Message :::::: ', data);

      // save chatting history in Redis, hash key 'chatting'
      writeMessage(data.message, 'chatting_History', data.roomCode);

      const pubMessage = {};
      pubMessage.type = 'message';
      pubMessage.roomCode = data.roomCode;
      pubMessage.client = socket.id;

      const message = JSON.stringify({
        redis: pubMessage,
        socket: data.message
      });
      pub.publish('chat', message, () => console.log('Pub Message Complete'));
    });

    // send my position to others
    socket.on('position', async data => {
      console.log('Position :::::: ', data);

      const userPosition = {};
      userPosition.longitude = data.position.coords.longitude;
      userPosition.latitude = data.position.coords.latitude;
      userPosition.timestamp = data.position.timestamp;
      userPosition.userId = data.position.userId;
      userPosition.thumbnail = data.thumbnail;
      writePosition(userPosition, data.roomCode, data.position.userId);

      const pubMessage = {};
      pubMessage.type = 'otherPosition';
      pubMessage.roomCode = data.roomCode;
      pubMessage.client = socket.id;

      const position = JSON.stringify({
        redis: pubMessage,
        socket: userPosition
      });
      pub.publish('chat', position, () => console.log('Pub Position Complete'));
    });
  });

  sub.on('message', (channel, data) => {
    const msg = JSON.parse(data);
    console.log('Redis Sub :::::: ', msg);
    const socket = io.sockets.sockets[msg.redis.client];

    if (socket !== undefined) {
      socket.broadcast.to(msg.redis.roomCode).emit(msg.redis.type, msg.socket);
    }
  });
};

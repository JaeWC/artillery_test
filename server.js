const express = require('express');
const app = express();
const http = require('http').createServer(app);
const PORT = process.env.PORT || 7000;

const cluster = require('cluster');
const os = require('os');

const cors = require('cors');
const bodyParser = require('body-parser');

const io = require('socket.io').listen(http, {
  transports: ['websocket', 'polling']
});

const redis = require('redis');
const redisAdapter = require('socket.io-redis');

const sticky = require('sticky-session');

const pub = redis.createClient();
const sub = redis.createClient();
sub.subscribe('chat');

const {
  writeMessage,
  writePosition,
  deleteHashKey
} = require('./redis/modules');

if (cluster.isMaster) {
  console.log(os.cpus().length);
  os.cpus().forEach(cpu => cluster.fork());
  cluster.on('exit', (worker, code, signal) => {
    if (code === 200) {
      cluster.fork();
    }
  });
}

if (!sticky.listen(http, 7000)) {
  http.once('listening', function() {
    console.log('server started on 7000 port');
  });
} else {
  // cors middleware
  app.use(cors());
  // body-parser middleware
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));

  io.on('connection', socket => {
    io.clients((error, clients) => {
      if (error) throw err;
      console.log('Clients :::::: ', clients);
    });

    // join chatting room
    socket.on('join', function(data) {
      console.log('Join :::::: ', data);

      const myPosition = {};
      myPosition.longitude = data.position.longitude;
      myPosition.latitude = data.position.latitude;
      myPosition.timestamp = data.position.timestamp;
      myPosition.userId = data.userId;

      socket.userInfo = { roomCode: data.roomCode, userId: data.userId };
      const info = JSON.stringify(socket.userInfo);

      socket.join(data.roomCode);
      writePosition(myPosition, data.roomCode, data.userId);
      pub.publish('chat', info);
    });

    // leave chatting room
    socket.on('leave', function(data) {
      socket.leave(data.roomCode, () => {
        socket.disconnect();
        console.log('Leave :::::: ', data);

        sub.quit();
        pub.publish('User Leave :::::: ', data.userId);

        deleteHashKey(data.roomCode, data.userId);
      });
    });

    socket.on('disconnect', data => {
      let userInfo = socket.userInfo;
      console.log('Disconnect :::::: ', userInfo);

      sub.quit();
      pub.publish('User Disconnect :::::: ', socket.id);
    });

    // send message to selected room members
    socket.on('message', async data => {
      console.log('Message :::::: ', data);

      if (socket.userInfo === undefined) {
        socket.userInfo = {
          roomCode: data.roomCode,
          userId: data.message.user._id
        };
        await socket.join(data.roomCode, () => {
          console.log(`${data.message.user._id} re-join at ${data.roomCode}`);
        });
      }
      // save chatting history in Redis, hash key 'chatting'
      writeMessage(data.message, 'chatting_History', data.roomCode);
      const message = JSON.stringify(data);
      pub.publish('chat', message);

      // socket.broadcast.to(data.roomCode).emit('message', data.message);
    });

    // send my position to others
    socket.on('position', async data => {
      console.log('Position :::::: ', data);

      if (socket.userInfo === undefined) {
        socket.userInfo = {
          roomCode: data.roomCode,
          userId: data.position.userId
        };
        await socket.join(data.roomCode, () => {
          console.log(
            `${socket.userInfo.userId} re-join at ${socket.userInfo.roomCode}`
          );
        });
      }

      const userPosition = {};
      userPosition.longitude = data.position.coords.longitude;
      userPosition.latitude = data.position.coords.latitude;
      userPosition.timestamp = data.position.timestamp;
      userPosition.userId = data.position.userId;
      userPosition.roomCode = data.roomCode;
      writePosition(userPosition, data.roomCode, data.position.userId);

      const position = JSON.stringify(userPosition);
      pub.publish('chat', position);

      // socket.broadcast.to(data.roomCode).emit('otherPosition', userPosition);
    });
  });

  sub.on('join', (channel, msg) => {
    const joining = JSON.parse(msg);
    io.sockets.to(joining.roomCode).emit('joinRoom', joining);
  });

  sub.on('message', (channel, msg) => {
    const message = JSON.parse(msg);
    io.sockets.to(message.roomCode).emit('message', message.message);
  });

  sub.on('position', (channel, msg) => {
    const userPosition = JSON.parse(msg);
    console.log(11111, userPosition);
    io.sockets.to(userPosition.roomCode).emit('otherPosition', userPosition);
  });

  app.post('/redis/position', async (req, res) => {
    const data = req.body;

    const userPosition = {};
    userPosition.longitude = data.position.longitude;
    userPosition.latitude = data.position.latitude;
    userPosition.timestamp = data.timestamp;
    userPosition.userId = data.userId;

    writePosition(userPosition, data.roomCode, data.userId);

    io.sockets.to(data.roomCode).emit('otherPosition', userPosition);
    res.json('success');
  });

  app.post('/redis/chatting', (req, res) => {
    const data = req.body;

    writeMessage(data.message, 'chatting_History', data.roomCode);

    res.json('success');
  });

  // http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

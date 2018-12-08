const express = require('express');
const app = express();
const http = require('http').createServer(app);
// const PORT = process.env.PORT || 7000;

const cors = require('cors');
const bodyParser = require('body-parser');

const io = require('socket.io').listen(http, {
  // Connection: 'keep-alive',
  transports: ['websocket', 'polling']
});
const redisAdapter = require('socket.io-redis');

const sticky = require('sticky-session');

const {
  writeMessage,
  writePosition,
  deleteHashKey
} = require('./redis/modules');

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

      socket.join(data.roomCode, () => {
        console.log(`${data.userId} is join in ${data.roomCode}`);
        writePosition(myPosition, data.roomCode, data.userId);
        socket.broadcast
          .to(data.roomCode)
          .emit('joinRoom', { userId: data.userId, position: data.position });
      });
    });

    // leave chatting room
    socket.on('leave', function(data) {
      socket.leave(data.roomCode, () => {
        socket.disconnect();
        console.log('Leave :::::: ', data.userId);

        deleteHashKey(data.roomCode, data.userId);
      });
    });

    socket.on('disconnect', data => {
      let userInfo = socket.userInfo;
      console.log('Disconnect :::::: ', userInfo);

      io.to(userInfo.roomCode).emit('leaveRoom', userInfo.userId);
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

      socket.broadcast.to(data.roomCode).emit('message', data.message);
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
      writePosition(userPosition, data.roomCode, data.position.userId);

      socket.broadcast.to(data.roomCode).emit('otherPosition', userPosition);
    });
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

  //error router
  app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

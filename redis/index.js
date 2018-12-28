const router = require('express').Router();

const { writeMessage, writePosition } = require('./modules');

module.exports = io =>
  router.post('/position', async (req, res) => {
    const data = req.body;

    const userPosition = {};
    userPosition.longitude = data.position.longitude;
    userPosition.latitude = data.position.latitude;
    userPosition.timestamp = data.timestamp;
    userPosition.userId = data.userId;
    userPosition.thumbnail = data.thumbnail;

    writePosition(userPosition, data.roomCode, data.userId);
    io.sockets.to(data.roomCode).emit('otherPosition', userPosition);
    res.json('success');
    return;
  });

router.post('/chatting', (req, res) => {
  const data = req.body;
  writeMessage(data.message, 'chatting_History', data.roomCode);

  res.json('success');
  return;
});

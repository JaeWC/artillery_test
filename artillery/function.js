'use strict';

module.exports = {
  setPosition
};

const shortid = require('shortid');

let roomCode = [];
for (var i = 0; i < 500; i++) {
  let code = shortid.generate();
  roomCode.push(code);
  roomCode.push(code);
  roomCode.push(code);
  roomCode.push(code);
  roomCode.push(code);
}

const TEXTS = [
  'Hello, this message is not real',
  'This message is made by J.',
  'I am doing Stress test',
  'I am using Artillery',
  'Sorry, I do not have more idea about this messages',
  'I want to go Home',
  'Wow what a beautiful day',
  'This is JavaScript',
  'This is node.js',
  '조금만 있으니까 재미없지?',
  '이번 테스트는 성공할 겁니다.'
];

function setPosition(userContext, events, done) {
  const userId = shortid.generate();
  const longitude = Math.random() * 1 + 127;
  const latitude = Math.random() * 2 + 33;
  const timeStamp = Date.now();
  const textIndex = Math.floor(Math.random() * TEXTS.length);

  userContext.vars.userId = userId;
  userContext.vars.longitude = longitude;
  userContext.vars.latitude = latitude;
  userContext.vars.timeStamp = timeStamp;
  userContext.vars.roomCode = roomCode[0];
  userContext.vars.text = TEXTS[textIndex];

  roomCode.shift();

  return done();
}

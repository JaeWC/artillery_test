const cluster = require('cluster');
const os = require('os');

const express = require('express');
const app = express();
const PORT = 3000;
const http = require('http').createServer(app);
const sticky = require('sticky-session');

if (!sticky.listen(http, PORT)) {
  http.once('listening', () => console.log(`server started on ${PORT} port`));
} else {
  if (cluster.isMaster) {
    os.cpus().forEach(cpu => cluster.fork());
    console.log(`Master ${process.pid} is running`);
    cluster.on('exit', (worker, code, signal) => {
      if (code === 200) {
        cluster.fork();
      }
    });
  } else {
    const morgan = require('morgan');
    const cors = require('cors');
    const bodyParser = require('body-parser');

    let io;
    const redisRouter = require('./redis/index')(io);
    io = require('./socket/index').listen(http);

    // cors middleware
    app.use(cors());
    // morgan middleware
    app.use(morgan('dev'));
    // body-parser middleware
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    app.use('/redis', redisRouter);

    //error router
    app.use((req, res, next) => {
      const err = new Error('Not Found');
      err.status = 404;
      next(err);
    });

    console.log(`Worker ${process.pid} started`);
  }
}

var createError = require('http-errors');
var express = require('express');
var session = require('express-session');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config();
const MongoStore = require('connect-mongo')(session);

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var mongoRouter = require('./routes/mongo');
var mlRouter = require('./routes/ml');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'client/build')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new MongoStore({
    url: process.env.MONGO_DATABASE_URL
  }),
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 * 5 * 12 // one year
  }
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/mongo', mongoRouter);
app.use('/ml', mlRouter);

app.get('*', function(req, res) {
  res.sendFile('index.html', {root: path.join(__dirname, 'client/build/')});
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

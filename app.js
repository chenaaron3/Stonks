var createError = require('http-errors');
var express = require('express');
var session = require('express-session');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config();
const MongoStore = require('connect-mongo')(session);
const passport = require('passport');
const mongoose = require('mongoose');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var mongoRouter = require('./routes/mongo');
var symbolRouter = require('./routes/symbol');
var alpacaRouter = require('./routes/alpaca');
var mlRouter = require('./routes/ml');
var testRouter = require('./routes/test');
var webhooksRouter = require('./routes/webhooks');

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

// mongo session
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

// mongoose connection for passport
mongoose.connect(process.env.MONGO_DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// passport session
app.use(passport.initialize());
app.use(passport.session());
// configure model
const Account = require('./models/account');
passport.use(Account.createStrategy());
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

// routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/mongo', mongoRouter);
app.use('/symbol', symbolRouter);
app.use('/alpaca', alpacaRouter);
app.use('/ml', mlRouter);
app.use('/test', testRouter);
app.use('/webhooks', webhooksRouter);

app.get('*', function (req, res) {
  res.sendFile('index.html', { root: path.join(__dirname, 'client/build/') });
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

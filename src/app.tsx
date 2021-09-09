import createError from 'http-errors';
import express from 'express';
import session from 'express-session';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import dotenv from 'dotenv';
dotenv.config();
import MongoStore from 'connect-mongo';
import passport from 'passport';
import mongoose from 'mongoose';

import indexRouter from './routes/index';
import usersRouter from './routes/users';
import mongoRouter from './routes/mongo';
import symbolRouter from './routes/symbol';
import alpacaRouter from './routes/alpaca';
import mlRouter from './routes/ml';
import testRouter from './routes/test';

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'client', 'build')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// mongo session
app.use(session({
  store: (MongoStore.create({
    mongoUrl: process.env.MONGO_DATABASE_URL
  }) as any),
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 * 5 * 12 // one year
  }
}));

// mongoose connection for passport
mongoose.connect(process.env.MONGO_DATABASE_URL);

// passport session
app.use(passport.initialize());
app.use(passport.session());

// configure model
import Account from './models/account';
passport.use(Account.createStrategy());
passport.serializeUser(Account.serializeUser() as any);
passport.deserializeUser(Account.deserializeUser());

// routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/mongo', mongoRouter);
app.use('/symbol', symbolRouter);
app.use('/alpaca', alpacaRouter);
app.use('/ml', mlRouter);
app.use('/test', testRouter);

app.get('*', function (req, res) {
  res.sendFile('index.html', { root: path.join(__dirname, 'client', 'build/') });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (req, res, next) {
  console.error(req)
  res.status(500).json({ error: `Internal Serverless Error - '${req}'` })
})

export default app;

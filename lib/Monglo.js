
/*!
 * Monglo
 * Copyright (c) 2012 Christian Sullivan <cs@euforic.co>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var EventEmitter = require('./events').EventEmitter
  , proto = require('./Proto')
  , utils = require('./utils');

// expose connect() as the module

exports.monglo = monglo;

/**
 * Framework version.
 */

exports.version = '0.1.3';

/**
 * Auto-load middleware getters.
 */

exports.middleware = {};

/**
 * Expose utilities.
 */

exports.utils = utils;

/**
 * Create a new Monglo Database.
 *
 * @return {Function}
 * @api public
 */

function monglo() {
  function app(req, res){ app.handle(req, res); }
  utils.merge(app, proto);
  utils.merge(app, EventEmitter.prototype);
  app.route = '/';
  app.stack = [];
  app.init();
  for (var i = 0; i < arguments.length; ++i) {
    app.use(arguments[i]);
  }
  return app;
}
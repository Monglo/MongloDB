
Monglo.use = function(action, fn){
  // default action to '/'
  if ('string' != typeof action) {
    fn = action;
    action = 'all';
  }

  // wrap sub-apps
  if ('function' == typeof fn.handle) {
    var server = fn;
    fn.action = action;
    fn = function(req, res, next){
      Monglo.handle(req, res, next);
    };
  }

  // wrap vanilla http.Servers
  if (fn instanceof Collection) {
    fn = fn.listeners('request')[0];
  }

  // add the middleware
  Monglo.debug('use %s %s', action || '/', fn.name || 'anonymous');
  this.stack.push({ action: action, handle: fn });

  return this;
};

/**
 * Handle database requests, punting them down
 * the middleware stack.
 *
 * @api private
 */

Monglo.handle = function(req, res, out) {
  var index = 0;

  function next(err) {
    var layer, path, status, c;

    // next callback
    layer = stack[index++];

    // all done
    if (!layer || res.headerSent) {
      // delegate to parent
      if (out) return out(err);

      // unhandled error
      if (err) {
        // default to 500
        if (res.statusCode < 400) res.statusCode = 500;
        Monglo.debug('default %s', res.statusCode);

        // respect err.status
        if (err.status) res.statusCode = err.status;

        // production gets a basic error message
        var msg = 'production' == env
          ? res.statusCode
          : err.stack || err.toString();

        // log to stderr in a non-test env
        if ('test' != env) console.error(err.stack || err.toString());
        if (res.headerSent) return true;
        if ('CLOSE' == req.method) return res.end();
        res.end(msg);
      } else {
        debug('default 404');
        res.statusCode = 404;
        if ('CLOSE' == req.method) return res.end();
        res.end('Cannot ' + req.method + ' ');
      }
      return;
    }

      Monglo.debug('%s', layer.handle.name || 'anonymous');
      var arity = layer.handle.length;
      if (err) {
        if (arity === 4) {
          layer.handle(err, req, res, next);
        } else {
          next(err);
        }
      } else if (arity < 4) {
        layer.handle(req, res, next);
      } else {
        next();
      }
    } catch (e) {
      next(e);
    }
  }
  next();
};
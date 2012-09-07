var Utils = {};

Utils._deepcopy = function (v) {
  if (typeof v !== "object")
    return v;
  if (v === null)
    return null; // null has typeof "object"
  if (utils.isArray(v)) {
    var ret = v.slice(0);
    for (var i = 0; i < v.length; i++)
      ret[i] = Utils._deepcopy(ret[i]);
    return ret;
  }
  var ret = {};
  for (var key in v)
    ret[key] = Utils._deepcopy(v[key]);
  return ret;
};

Utils.each = Utils.forEach = function(obj, iterator, context) {
    if (obj === null) return;
    var nativeForEach = Array.prototype.forEach;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

Utils.isArray = Array.isArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

Utils.debug = function(data){ };

var utils = Utils;
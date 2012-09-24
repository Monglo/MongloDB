/*!
 * Monglo - sort
 * Copyright (c) 2012 Christian Sullivan <cs@euforic.co>
 * MIT Licensed
 */

Collection._compileSort = function (spec) {
  var keys = [];
  var asc = [];

  if (spec instanceof Array) {
    for (var i = 0; i < spec.length; i++) {
      if (typeof spec[i] === "string") {
        keys.push(spec[i]);
        asc.push(true);
      } else {
        keys.push(spec[i][0]);
        asc.push(spec[i][1] !== "desc");
      }
    }
  } else if (typeof spec === "object") {
    for (key in spec) {
      keys.push(key);
      asc.push(!(spec[key] < 0));
    }
  } else {
    throw Error("Bad sort specification: ", JSON.stringify(spec));
  }

  if (keys.length === 0)
    return function () {return 0;};

  // eval() does not return a value in IE8, nor does the spec say it
  // should. Assign to a local to get the value, instead.
  var _func;
  var code = "_func = (function(c){return function(a,b){var x;";
  for (var i = 0; i < keys.length; i++) {
    if (i !== 0)
      code += "if(x!==0)return x;";
    code += "x=" + (asc[i] ? "" : "-") +
      "c(a[" + JSON.stringify(keys[i]) + "],b[" +
      JSON.stringify(keys[i]) + "]);";
  }
  code += "return x;};})";

  eval(code);
  return _func(Collection._f._cmp);
};
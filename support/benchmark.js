/**
 * Module dependencies.
 */

var uubench = require('uubench')
  , Monglo = require('../');


var suite = new uubench.Suite({
  min: 200,
  result: function(name, stats){
    var persec = 1000 / stats.elapsed
      , ops = stats.iterations * persec;
    console.log('%s: %d', name, ops | 0);
  }
});

function setup() {

  var fn = function(){};

  suite.bench('tiny' + suffix, function(next){
    fn();
    next();
  });

  var fn2 = function(){};

  suite.bench('small' + suffix, function(next){
    fn2();
    next();
  });

  var fn3 = function(){};

  suite.bench('small locals' + suffix, function(next){
    fn3();
    next();
  });


  var fn4 = function(){};

  suite.bench('medium' + suffix, function(next){
    fn4();
    next();
  });

  var fn5 = function(){};

  suite.bench('large' + suffix, function(next){
    fn5();
    next();
  });
}

setup();

suite.run();
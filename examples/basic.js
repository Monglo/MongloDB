var monglo = require('../').monglo;
//Demo middleware
function testMW(){
  return function(req, res, next) {
    console.log(req);
    console.log('FOUND URL');
    next();
  };
}

//Demo middleware
function otherMW(){
  return function(req, res, next) {
    console.log('hello-1');
    next();
  };
}

var tester = monglo()
  .use(testMW())
  .use('collection/insert',otherMW())
  .use('collection/update',otherMW)
  .set('env','development');

  var db = tester.connect('euforic');

tester.use('collection/update',function(req,res){
  console.log('after Test');
});

  var test = db.collection('test')
    .insert({a:33,b:2,c:3})
    .insert({a:33,b:2,c:3}, function(){console.log('inserting'); })
    .insert({a:{sub:11},b:2,c:3})
    .insert({a:222,b:2,c:3})
    .update({'a.sub':11}, {$set:{b:'WORkS'}})
    .find()
    .fetch();
    console.log(test);
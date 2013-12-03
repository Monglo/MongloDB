var monglo = require('../build').Monglo;
var db = monglo('DemoDB');

function DemoStore(){
  return {
    insert : function(args){  },
    update : function(args){  },
    open   : function(args){  },
    remove : function(args){  },
       all : function(args){  }
  };
}

db.use('store', new DemoStore());

describe('Collection', function(){

  describe('#open()', function(){
    it('should work', function(){
      var collection = db.collection('testerop');
    });
  });

  describe('#drop()', function(){
    it('should work', function(){

    });
  });

  describe('#insert()', function(){
    it('should work', function(){
      var collection2 = db.collection('tester3');
      collection2.insert({field:'test'}, function(err,doc){
        doc.should.be.a('object').have.property('_id');
      });
      db.tester3.insert({field:'test20', age:23, sub:{sub2:12}});
    });
  });

  describe('#remove()', function(){
    it('should work', function(){
      var collectionRM = db.collection('testrm');
      collectionRM.insert({_id:411, field:'test10', age:10, sub:{sub2:1}});
      collectionRM.remove({_id:411});
    });
  });

  describe('#update()', function(){
    it('should work', function(){
      var testup = db.collection('testup');
      testup.insert({_id:90210, field:'test20', age:20, sub:{sub2:1}});
      testup.update({_id:90210}, {_id:33333, field:'test20', age:20, sub:{sub2:1} });
    });
  });

  describe('#find()', function(){
    it('should work', function(){
      var collectionFD = db.collection('testfd');
      collectionFD.insert({field:'test20', age:23, sub:{sub2:12}});
      collectionFD.insert({field:'test20', age:25, sub:{sub2:14}});
      collectionFD.insert({field:'test20', age:26, sub:{sub2:12}});
      collectionFD.insert({field:'test20', age:27, sub:{sub2:11}});
      collectionFD.insert({field:'test20', age:28, sub:{sub2:17}});
      collectionFD.find({'sub.sub2':12}, function(err,docs){
        if(err){ throw new Error(err); }
          docs.fetch();

      });
    });
  });

  describe('#findOne()', function(){
    it('should work', function(){
      var ddd = db.collection('dddd');
      ddd.insert({_id:90212, field:'test20', age:20, sub:{sub2:1}});
      ddd.insert({_id:90212, field:'test20', age:20, sub:{sub2:1}});
      ddd.insert({_id:90212, field:'test20', age:20, sub:{sub2:1}});
      ddd.findOne({field:"test20"}, function(err,doc) {  });
    });
  });

  describe('#snapshot()', function(){
    it('should work', function(){

    });
  });

  describe('#restore()', function(){
    it('should work', function(){

    });
  });

  describe('#pauseObserver()', function(){
    it('should work', function(){

    });
  });

  describe('#resumeObserver()', function(){
    it('should work', function(){

    });
  });

});
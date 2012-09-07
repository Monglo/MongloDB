var ObjectId = require('../lib/ObjectId').ObjectID;

  describe('#ObjectId()', function(){
    it('should Create ObjectId Object', function(){
      var myid = new ObjectId('5044555b65bedb5e56000002');
      var a = myid.getTimestamp();
      var b = myid.toJSON();
      var c = myid.equals('5044555b65bedb5e56000002');
      var d = myid.generationTime;
      var e = myid.toString();
    });
  });
/**
 * Local File System sync adapter which will store all models in
 * an on device flat file
 */
var dbDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, 'db');
if (! dbDir.exists()) {
    dbDir.createDirectory();
}

module.exports = {
  update : function(args) {
    var filename = args.collection.name + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
      f.write(JSON.stringify(args.collection.docs));
  },

  createCollection : function(args) {
    var filename = args.collection.name + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
    var exists = f.exists();
    if (exists) {
      try{ args.collection.docs = JSON.parse(f.read()); }catch(e){ args.collection.docs = {}; }
    }else{
      f.write(JSON.stringify(args.collection.docs));
    }
  },

  insert : function(args) {
    var filename = args.collection.name + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
      f.write(JSON.stringify(args.collection.docs));
  },

  remove : function(args) {
    var filename = args.collection.name + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
    if (f.exists()) { f.deleteFile(); }
  }
};


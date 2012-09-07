/**
 * Local File System sync adapter which will store all models in
 * an on device flat file
 */
var dbDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, 'db');
if (! dbDir.exists()) {
    dbDir.createDirectory();
}

module.exports = {
  update : function(db,opts) {
    var filename = opts.collection.collectionName + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
      f.write(JSON.stringify(opts.collection.docs));
  },

  createCollection : function(db,opts) {
    var filename = opts.collection.collectionName + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
    var exists = f.exists();
    if (exists) {
      opts.collection.docs = JSON.parse(f.read());
    }else{
      f.write(JSON.stringify(opts.collection.docs));
    }
  },

  insert : function(db,opts) {
    var filename = opts.collection.collectionName + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
      f.write(JSON.stringify(opts.collection.docs));
  },

  remove : function(db,opts) {
    var filename = opts.collection.collectionName + '.json';
    var f = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, 'db/' + filename);
    if (f.exists()) { f.deleteFile(); }
  }
};


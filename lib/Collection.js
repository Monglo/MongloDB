/*!
 * Monglo - collection
 * Copyright (c) 2012 Christian Sullivan <cs@euforic.co>
 * MIT Licensed
 */

function Collection (db, collectionName, pkFactory, options) {
   if(!(this instanceof Collection)) return new Collection(db, collectionName, pkFactory, options);

  checkCollectionName(collectionName);

  this.db = db;
  this.name = collectionName;
  this.docs = {};
  this.snapshots = [];
  this.opts = options !== null && ('object' === typeof options) ? options : {};
  var self = this;
}

Collection.prototype.__proto__ = EventEmitter.prototype;

Collection.prototype.constructor = Collection;

var testForFields = {'limit' : 1, 'sort' : 1, 'fields' : 1, 'skip' : 1, 'hint' : 1, 'explain' : 1, 'snapshot' : 1
  , 'timeout' : 1, 'tailable' : 1, 'batchSize' : 1, 'raw' : 1, 'read' : 1
  , 'returnKey' : 1, 'maxScan' : 1, 'min' : 1, 'max' : 1, 'showDiskLoc' : 1, 'comment' : 1, 'dbName' : 1, 'exhaust': 1
  , 'tailableRetryInterval': 1};

Collection.prototype.find = function (fn) {
  var self = this;
  var callback = fn||function(){};
  var options
    , args = Array.prototype.slice.call(arguments, 0)
    , has_callback = typeof args[args.length - 1] === 'function'
    , has_weird_callback = typeof args[0] === 'function'
    , callback = has_callback ? args.pop() : (has_weird_callback ? args.shift() : null)
    , len = args.length
    , selector = len >= 1 ? args[0] : {}
    , fields = len >= 2 ? args[1] : undefined;

  if(len === 1 && has_weird_callback) {
    // backwards compat for callback?, options case
    selector = {};
    options = args[0];
  }

  if(len === 2 && !utils.isArray(fields)) {
    var fieldKeys = Object.getOwnPropertyNames(fields);
    var is_option = false;

    for(var i = 0; i < fieldKeys.length; i++) {
      if(testForFields[fieldKeys[i]] !== null) {
        is_option = true;
        break;
      }
    }

    if(is_option) {
      options = fields;
      fields = undefined;
    } else {
      options = {};
    }
  } else if(len === 2 && utils.isArray(fields) && !utils.isArray(fields[0])) {
    var newFields = {};
    // Rewrite the array
    for(var i = 0; i < fields.length; i++) {
      newFields[fields[i]] = 1;
    }
    // Set the fields
    fields = newFields;
  }

  if(3 === len) {
    options = args[2];
  }

  // Ensure selector is not null
  selector = selector === null ? {} : selector;
  // Validate correctness off the selector
  var object = selector;

  // Validate correctness of the field selector
  var object = fields;

  // Check special case where we are using an objectId
  if(selector instanceof ObjectID) {
    selector = {_id:selector};
  }

  // If it's a serialized fields field we need to just let it through
  // user be warned it better be good
  if(options && options.fields) {
    fields = {};

    if(utils.isArray(options.fields)) {
      if(!options.fields.length) {
        fields._id = 1;
      } else {
        for (var i = 0, l = options.fields.length; i < l; i++) {
          fields[options.fields[i]] = 1;
        }
      }
    } else {
      fields = options.fields;
    }
  }

  if (!options) options = {};
  options.skip = len > 3 ? args[2] : options.skip ? options.skip : 0;
  options.limit = len > 3 ? args[3] : options.limit ? options.limit : 0;

  // Set option
  var o = options;

    // callback for backward compatibility
      // TODO refactor Cursor args
    var cursor = new Cursor(this.db, this, selector, fields, o.skip, o.limit, o.sort);

  this.emit('find', selector,cursor,o);
  this.db._executeCommand('find', {collection:self,selector:selector,options:o});
  callback(null,cursor);
  return this;
};

Collection.prototype.findOne = function (selector, options, fn) {
  var self = this;
  if('function' === typeof options){
    fn = options;
    options = {};
  }
  var callback = fn||function(){};
  if (arguments.length === 0) {
    selector = {};
  }
  //options = options || {};
  //options.limit = 1;
  self.find(selector, function(err,cursor){
    var doc = (!err) ? cursor.fetch()[0] : null;
    callback(err,doc);
  });
  return this;
};

// TODO enforce rule that field names can't start with '$' or contain '.'
// (real mongodb does in fact enforce this)
// TODO possibly enforce that 'undefined' does not appear (we assume
// this in our handling of null and $exists)
Collection.prototype.insert = function (doc,options,fn) {
  var self = this;
  var callback = fn||function(){};
  var options = options || {};

  if('function' === typeof options){
    callback = options; options = {};
  }


  doc = utils._deepcopy(doc);

  if('number' === typeof doc._id){
    doc._id = String(doc._id);
  }

  doc._id = (doc._id||'').replace(/\D/g,'');

  if (!doc[doc._id] && !doc._id.length){
    doc._id = new ObjectId();
  }

  doc.timestamp = new ObjectId().generationTime;
  self.docs[String(doc._id)] = doc;

// Hack to prevent updates from registering as inserts also
 if(options.ignore){  callback(doc); return this; }

 self.emit('insert',doc);
 this.db._executeCommand('insert',{collection:self, doc:self.docs[doc._id]});
 callback(null,doc);
 return this;
};

Collection.prototype.remove = function (selector,fn) {
  var self = this;
  var callback = fn||function(){};
  var remove = [];
  var query_remove = [];

  var selector_f = Selector._compileSelector(selector);
  for (var id in self.docs) {
    var doc = self.docs[id];
    if (selector_f(doc)) {
      remove.push(id);
    }
  }
  for (var i = 0; i < remove.length; i++) {
    delete self.docs[remove[i]];
  }

  self.emit('remove', selector);
  this.db._executeCommand('remove',{collection:self, selector:selector, docs:remove});
  callback(null);
  return this;
};

// TODO atomicity: if multi is true, and one modification fails, do
// we rollback the whole operation, or what?
Collection.prototype.update = function (selector, mod, options, fn) {
  var self = this;
  var callback = fn||function(){};
  if('function' === typeof options){
    callback = options; options = {};
  }
  options = options || {};

  var self = this;
  var any = false;
  var updatedDocs =[];
  var selector_f = Selector._compileSelector(selector);
  for (var id in self.docs) {
    var doc = self.docs[id];
    if (selector_f(doc)) {
      updatedDocs.push(doc);
      Collection._modify(doc, mod);
      if (!options.multi) {
        any = true;
        self.emit('update', selector, mod, options);
        self.db._executeCommand('update',{collection:self, selector:selector, modifier:mod, options:options, docs:updatedDocs });
        callback(null,self.docs[id]);
        return this;
      }
    }
  }

  if (options.upsert) {
    throw new Error("upsert not yet implemented");
  }

  if (options.upsert && !any) {
    // TODO is this actually right? don't we have to resolve/delete
    // $-ops or something like that?
    insert = utils._deepcopy(selector);
    Collection._modify(insert, mod);
    self.insert(insert,{ignore:true});
  }
  var newDoc = self.find(selector).fetch();
  //TODO fix this ghetto return
  self.emit('update', {collection:self, selector:selector, modifier:mod, options:options, docs:newDoc });
  self.db._executeCommand('update',{collection:self, selector:selector, modifier:mod, options:options, docs:newDoc });
  callback(null,newDoc);
  return this;
};

Collection.prototype.save = function ( obj, fn ){
  var self = this;
  var callback = fn||function(){};
  if(self.docs[obj._id]){
    self.update({_id:obj._id},callback);
  } else{
    self.insert(obj,callback);
  }
};

Collection.prototype.ensureIndex = function(){
  //TODO Implement EnsureIndex
  throw new Error('Collection#ensureIndex unimplemented by driver');
};

// TODO document (at some point)
// TODO test
// TODO obviously this particular implementation will not be very efficient
Collection.prototype.backup = function (backupID,fn) {
  if('function' === typeof backupID){
    fn = backupID;
    backupID = new ObjectId();
  }
  var callback = fn||function(){};
  var snapID = backupID;
  this.snapshots[snapID] = this.docs;
  this.emit('snapshot', {_id : this.docs, data : this.docs });
  callback(null,this.snapshots[snapID]);
  return this;
};

// Lists available Backups
Collection.prototype.backups = function (fn) {
  var callback = fn||function(){};
  var keys = [];
  var backups = this.snapshots;
  for(var id in backups) {
    keys.push({id:id, data:backups[id]});
  }
  callback(keys);
  return this;
};

// Lists available Backups
Collection.prototype.removeBackup = function (backupID,fn) {
  if(!backupID || 'function' === typeof backupID){
    fn = backupID;
    this.snapshots = {};
  } else {
    var id = String(backupID);
    delete this.snapshots[id];
  }
  var callback = fn||function(){};
  callback(null);
  return this;
};

Object.size = function(obj) { var size = 0, key; for (key in obj) { if (obj.hasOwnProperty(key)) size++; } return size; };

// Restore the snapshot. If no snapshot exists, raise an exception;
Collection.prototype.restore = function ( backupID, fn ) {
  var callback = fn||function(){};
  var snapshotCount = Object.size(this.snapshots);
  if (snapshotCount===0){ throw new Error("No current snapshot");}
  var backupData = this.snapshots[backupID];
  if(!backupData){ throw new Error("Unknown Backup ID "+backupID); }
  this.docs = backupData;
  this.emit('restore');
  callback(null);
  return this;
};

/**
 * @ignore
 */
var checkCollectionName = function checkCollectionName (collectionName) {
  if ('string' !== typeof collectionName) {
    throw new Error("collection name must be a String");
  }

  if (!collectionName || collectionName.indexOf('..') != -1) {
    throw new Error("collection names cannot be empty");
  }

  if (collectionName.indexOf('$') != -1 &&
      collectionName.match(/((^\$cmd)|(oplog\.\$main))/) === null) {
    throw new Error("collection names must not contain '$'");
  }

  if (collectionName.match(/^\.|\.$/) !== null) {
    throw new Error("collection names must not start or end with '.'");
  }
};
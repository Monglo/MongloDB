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
  this.opts = options != null && ('object' === typeof options) ? options : {};
  var self = this;
}

Collection.prototype.__proto__ = EventEmitter.prototype;

Collection.prototype.constructor = Collection;

var testForFields = {'limit' : 1, 'sort' : 1, 'fields' : 1, 'skip' : 1, 'hint' : 1, 'explain' : 1, 'snapshot' : 1
  , 'timeout' : 1, 'tailable' : 1, 'batchSize' : 1, 'raw' : 1, 'read' : 1
  , 'returnKey' : 1, 'maxScan' : 1, 'min' : 1, 'max' : 1, 'showDiskLoc' : 1, 'comment' : 1, 'dbName' : 1, 'exhaust': 1
  , 'tailableRetryInterval': 1};

Collection.prototype.find = function () {
  var self = this;
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
      if(testForFields[fieldKeys[i]] != null) {
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
  selector = selector == null ? {} : selector;
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
        fields['_id'] = 1;
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
  return (callback) ? callback(cursor) : cursor;
};

Collection.prototype.findOne = function (selector, options) {
  if (arguments.length === 0)
    selector = {};

  //options = options || {};
  //options.limit = 1;
  return this.find(selector).fetch()[0];
};

// TODO enforce rule that field names can't start with '$' or contain '.'
// (real mongodb does in fact enforce this)
// TODO possibly enforce that 'undefined' does not appear (we assume
// this in our handling of null and $exists)
Collection.prototype.insert = function (doc,options,cb) {
  var self = this;
  if('function' === typeof options){
    cb = options; options = {};
  }
  options = options || {};
  doc = utils._deepcopy(doc);

  if('number' === typeof doc._id){
    doc._id = doc._id+'';
  }

  doc._id = (doc._id || '').replace(/\D/g,'');

  if (!doc[doc._id] && !doc._id.length){
    doc._id = new ObjectId();
  }
  doc.timestamp = new ObjectId().generationTime;
  self.docs[doc._id] = doc;

// Hack to prevent updates from registering as inserts also
 if(options.ignore){  return (cb) ? cb(doc) : doc; }

 self.emit('insert',doc);
 this.db._executeCommand('insert',{collection:self, doc:self.docs[doc._id]});
 if(cb){ cb(doc); }
 return this;
};

Collection.prototype.remove = function (selector) {
  var self = this;
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
  return this;
};

// TODO atomicity: if multi is true, and one modification fails, do
// we rollback the whole operation, or what?
Collection.prototype.update = function (selector, mod, options, cb) {
  var self = this;
  if('function' === typeof options){
    cb = options; options = {};
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
        return (cb) ? cb(self.docs[id]) : self.docs[id];
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
  if(cb){ cb(newDoc); }
  return this;
};

Collection.prototype.save = function(obj,cb){
  var self = this;
  if(self.docs[obj._id]){
    self.update({_id:obj._id});
  } else{
    self.insert(obj);
  }
};

Collection.prototype.ensureIndex = function(){
  //TODO Implement EnsureIndex
  throw new Error('Collection#ensureIndex unimplemented by driver');
};

// TODO document (at some point)
// TODO test
// TODO obviously this particular implementation will not be very efficient
Collection.prototype.backup = function () {
  var snapID = new ObjectId();
  this.snapshots[snapID] = {};
  for (var id in this.docs){
    this.snapshots[snapID][id] = this.docs[id];
  }
  this.stores.snapshot({_id : this.docs[id], data : this.docs[id]});
  this.emit('snapshot', {_id : this.docs[id], data : this.docs[id]});
};

// Lists available Backups
Collection.prototype.backups = function () {
  var keys = [];
  for(var k in obj) {
    keys.push({id:k, timestamp:ObjectId.hexToTimestamp(k), data:obj[k]});
  }
  return keys;
};

// Lists available Backups
Collection.prototype.deleteBackup = function (id) {
  delete this.snapshots[id];
  return keys;
};

// Restore the snapshot. If no snapshot exists, raise an
// exception.
// TODO document (at some point)
// TODO test
Collection.prototype.restore = function (id,rm,cb) {
  if (!this.snapshots.length){
    throw new Error("No current snapshot");
  }

  if('function' === typeof rm){ cb = rm; rm = false; }

  this.docs = this.snapshots[id||0];
  // Rerun all queries from scratch. (TODO should do something more
  // efficient -- diffing at least; ideally, take the snapshot in an
  // efficient way, say with an undo log, so that we can efficiently
  // tell what changed).
  for (var qid in this.queries) {
    var query = this.queries[qid];

    var old_results = query.results;

    query.results = query.cursor._getRawObjects();

    if (!this.paused)
      Collection._diffQuery(old_results, query.results, query, true);
  }
  this.emit('restore');
  if(cb){ return cb(); }
};

/**
 * @ignore
 */
var checkCollectionName = function checkCollectionName (collectionName) {
  if ('string' !== typeof collectionName) {
    throw Error("collection name must be a String");
  }

  if (!collectionName || collectionName.indexOf('..') != -1) {
    throw Error("collection names cannot be empty");
  }

  if (collectionName.indexOf('$') != -1 &&
      collectionName.match(/((^\$cmd)|(oplog\.\$main))/) == null) {
    throw Error("collection names must not contain '$'");
  }

  if (collectionName.match(/^\.|\.$/) != null) {
    throw Error("collection names must not start or end with '.'");
  }
};
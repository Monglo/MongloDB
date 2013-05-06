/*!
 * Monglo - collection
 * Copyright (c) 2012 Christian Sullivan <cs@euforic.co>
 * MIT Licensed
 */

var EventEmitter = require('emitter')
  , ObjectId = require('./ObjectId');

module.exports = Collection;

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
  if(selector instanceof ObjectId) {
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
 * [_modify description]
 * @param  {[type]} doc [description]
 * @param  {[type]} mod [description]
 * @return {[type]}     [description]
 */

Collection._modify = function (doc, mod) {
  var is_modifier = false;
  for (var k in mod) {
    // IE7 doesn't support indexing into strings (eg, k[0]), so use substr.
    // Too bad -- it's far slower:
    // http://jsperf.com/testing-the-first-character-of-a-string
    is_modifier = k.substr(0, 1) === '$';
    break; // just check the first key.
  }

  var new_doc;

  if (!is_modifier) {
    if (mod._id && doc._id !== mod._id) {
      Monglo._debug("_id ignored : Cannot change the _id of a document");
    }
    // replace the whole document
    for (var k in mod) {
      if (k.substr(0, 1) === '$')
        throw Error("Field name may not start with '$'");
      if (/\./.test(k))
        throw Error("Field name may not contain '.'");
    }
    new_doc = mod;
  } else {
    // apply modifiers
    var new_doc = utils._deepcopy(doc);

    for (var op in mod) {
      var mod_func = Collection._modifiers[op];
      if (!mod_func)
        throw Error("Invalid modifier specified " + op);
      for (var keypath in mod[op]) {
        // XXX mongo doesn't allow mod field names to end in a period,
        // but I don't see why.. it allows '' as a key, as does JS
        if (keypath.length && keypath[keypath.length-1] === '.')
          throw Error("Invalid mod field name, may not end in a period");

        var arg = mod[op][keypath];
        var keyparts = keypath.split('.');
        var no_create = !!Collection._noCreateModifiers[op];
        var forbid_array = (op === "$rename");
        var target = Collection._findModTarget(new_doc, keyparts,
                                                    no_create, forbid_array);
        var field = keyparts.pop();
        mod_func(target, field, arg, keypath, new_doc);
      }
    }
  }

  // move new document into place
  for (var k in doc) {
    if (k !== '_id')
      delete doc[k];
  }
  for (var k in new_doc) {
    doc[k] = new_doc[k];
  }
};

// for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],
// and then you would operate on the 'e' property of the returned
// object. if no_create is falsey, creates intermediate levels of
// structure as necessary, like mkdir -p (and raises an exception if
// that would mean giving a non-numeric property to an array.) if
// no_create is true, return undefined instead. may modify the last
// element of keyparts to signal to the caller that it needs to use a
// different value to index into the returned object (for example,
// ['a', '01'] -> ['a', 1]). if forbid_array is true, return null if
// the keypath goes through an array.
Collection._findModTarget = function (doc, keyparts, no_create,
                                      forbid_array) {
  for (var i = 0; i < keyparts.length; i++) {
    var last = (i === keyparts.length - 1);
    var keypart = keyparts[i];
    var numeric = /^[0-9]+$/.test(keypart);
    if (no_create && (!(typeof doc === "object") || !(keypart in doc)))
      return undefined;
    if (doc instanceof Array) {
      if (forbid_array)
        return null;
      if (!numeric)
        throw Error("can't append to array using string field name ["
                    + keypart + "]");
      keypart = parseInt(keypart);
      if (last)
        // handle 'a.01'
        keyparts[i] = keypart;
      while (doc.length < keypart)
        doc.push(null);
      if (!last) {
        if (doc.length === keypart)
          doc.push({});
        else if (typeof doc[keypart] !== "object")
          throw Error("can't modify field '" + keyparts[i + 1] +
                      "' of list value " + JSON.stringify(doc[keypart]));
      }
    } else {
      // XXX check valid fieldname (no $ at start, no .)
      if (!last && !(keypart in doc))
        doc[keypart] = {};
    }

    if (last)
      return doc;
    doc = doc[keypart];
  }

  // notreached
};

Collection._noCreateModifiers = {
  $unset: true,
  $pop: true,
  $rename: true,
  $pull: true,
  $pullAll: true
};

Collection._modifiers = {
  $inc: function (target, field, arg) {
    if (typeof arg !== "number")
      throw Error("Modifier $inc allowed for numbers only");
    if (field in target) {
      if (typeof target[field] !== "number")
        throw Error("Cannot apply $inc modifier to non-number");
      target[field] += arg;
    } else {
      target[field] = arg;
    }
  },
  $set: function (target, field, arg) {
    target[field] = utils._deepcopy(arg);
  },
  $unset: function (target, field, arg) {
    if (target !== undefined) {
      if (target instanceof Array) {
        if (field in target)
          target[field] = null;
      } else
        delete target[field];
    }
  },
  $push: function (target, field, arg) {
    var x = target[field];
    if (x === undefined)
      target[field] = [arg];
    else if (!(x instanceof Array))
      throw Error("Cannot apply $push modifier to non-array");
    else
      x.push(utils._deepcopy(arg));
  },
  $pushAll: function (target, field, arg) {
    if (!(typeof arg === "object" && arg instanceof Array))
      throw Error("Modifier $pushAll/pullAll allowed for arrays only");
    var x = target[field];
    if (x === undefined)
      target[field] = arg;
    else if (!(x instanceof Array))
      throw Error("Cannot apply $pushAll modifier to non-array");
    else {
      for (var i = 0; i < arg.length; i++)
        x.push(arg[i]);
    }
  },
  $addToSet: function (target, field, arg) {
    var x = target[field];
    if (x === undefined)
      target[field] = [arg];
    else if (!(x instanceof Array))
      throw Error("Cannot apply $addToSet modifier to non-array");
    else {
      var isEach = false;
      if (typeof arg === "object") {
        for (var k in arg) {
          if (k === "$each")
            isEach = true;
          break;
        }
      }
      var values = isEach ? arg["$each"] : [arg];
      _.each(values, function (value) {
        for (var i = 0; i < x.length; i++)
          if (Collection._f._equal(value, x[i]))
            return;
        x.push(value);
      });
    }
  },
  $pop: function (target, field, arg) {
    if (target === undefined)
      return;
    var x = target[field];
    if (x === undefined)
      return;
    else if (!(x instanceof Array))
      throw Error("Cannot apply $pop modifier to non-array");
    else {
      if (typeof arg === 'number' && arg < 0)
        x.splice(0, 1);
      else
        x.pop();
    }
  },
  $pull: function (target, field, arg) {
    if (target === undefined)
      return;
    var x = target[field];
    if (x === undefined)
      return;
    else if (!(x instanceof Array))
      throw Error("Cannot apply $pull/pullAll modifier to non-array");
    else {
      var out = []
      if (typeof arg === "object" && !(arg instanceof Array)) {
        // XXX would be much nicer to compile this once, rather than
        // for each document we modify.. but usually we're not
        // modifying that many documents, so we'll let it slide for
        // now

        // XXX _compileSelector isn't up for the job, because we need
        // to permit stuff like {$pull: {a: {$gt: 4}}}.. something
        // like {$gt: 4} is not normally a complete selector.
        // same issue as $elemMatch possibly?
        var match = Collection._compileSelector(arg);
        for (var i = 0; i < x.length; i++)
          if (!match(x[i]))
            out.push(x[i])
      } else {
        for (var i = 0; i < x.length; i++)
          if (!Collection._f._equal(x[i], arg))
            out.push(x[i]);
      }
      target[field] = out;
    }
  },
  $pullAll: function (target, field, arg) {
    if (!(typeof arg === "object" && arg instanceof Array))
      throw Error("Modifier $pushAll/pullAll allowed for arrays only");
    if (target === undefined)
      return;
    var x = target[field];
    if (x === undefined)
      return;
    else if (!(x instanceof Array))
      throw Error("Cannot apply $pull/pullAll modifier to non-array");
    else {
      var out = []
      for (var i = 0; i < x.length; i++) {
        var exclude = false;
        for (var j = 0; j < arg.length; j++) {
          if (Collection._f._equal(x[i], arg[j])) {
            exclude = true;
            break;
          }
        }
        if (!exclude)
          out.push(x[i]);
      }
      target[field] = out;
    }
  },
  $rename: function (target, field, arg, keypath, doc) {
    if (keypath === arg)
      // no idea why mongo has this restriction..
      throw Error("$rename source must differ from target");
    if (target === null)
      throw Error("$rename source field invalid");
    if (typeof arg !== "string")
      throw Error("$rename target must be a string");
    if (target === undefined)
      return;
    var v = target[field];
    delete target[field];

    var keyparts = arg.split('.');
    var target2 = Collection._findModTarget(doc, keyparts, false, true);
    if (target2 === null)
      throw Error("$rename target field invalid");
    var field2 = keyparts.pop();
    target2[field2] = v;
  },
  $bit: function (target, field, arg) {
    // XXX mongo only supports $bit on integers, and we only support
    // native javascript numbers (doubles) so far, so we can't support $bit
    throw Error("$bit is not supported");
  }
};

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
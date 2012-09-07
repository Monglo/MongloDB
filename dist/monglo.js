
function Cursor(db, collection, selector, fields, skip, limit,sort) {
  this.db = db;
  this.collection = collection;
  this.selector = selector;
  this.fields = fields;
  this.skipValue = (skip === null) ? 0 : skip;
  this.limitValue = (limit === null) ? 0 : limit;
  this.sortValue = sort;

  // This name

 if ((typeof this.selector === "string") || (typeof this.selector === "number")) {
    // stash for fast path
    this.selector_id = this.selector;
    this.selector_f = Selector._compileSelector(this.selector);
  } else {
    this.selector_f = Selector._compileSelector(this.selector);
    this.sort_f = this.sortValue ? Collection._compileSort(this.sortValue) : null;
  }

    this.db_objects = null;
    this.cursor_pos = 0;
  }

Cursor.prototype.rewind = function () {
  var self = this;
  self.db_objects = null;
  self.cursor_pos = 0;
};

Cursor.prototype.forEach = function (callback) {
  var self = this;
  var doc;

  if (self.db_objects === null)
    self.db_objects = self._getRawObjects();

  while (self.cursor_pos < self.db_objects.length)
    callback(utils._deepcopy(self.db_objects[self.cursor_pos++]));
};

Cursor.prototype.map = function (callback) {
  var self = this;
  var res = [];
  self.forEach(function (doc) {
    res.push(callback(doc));
  });
  return res;
};

Cursor.prototype.fetch = function () {
  var self = this;
  var res = [];
  self.forEach(function (doc) {
    res.push(doc);
  });
  return res;
};

Cursor.prototype.count = function () {
  var self = this;

  if (self.db_objects === null)
    self.db_objects = self._getRawObjects();

  return self.db_objects.length;
};

Cursor.prototype.sort = function(){

};

Cursor.prototype.limit = function(){

};

// constructs sorted array of matching objects, but doesn't copy them.
// respects sort, skip, and limit properties of the query.
// if sort_f is falsey, no sort -- you get the natural order
Cursor.prototype._getRawObjects = function () {
  var self = this;

  // fast path for single ID value
  if (self.selector_id && (self.selector_id in self.collection.docs))
    return [self.collection.docs[self.selector_id]];

  // slow path for arbitrary selector, sort, skip, limit
  var results = [];
  for (var id in self.collection.docs) {
    var doc = self.collection.docs[id];
    if (self.selector_f(doc))
      results.push(doc);
  }

  if (self.sort_f)
    results.sort(self.sort_f);

  var idx_start = self.skipValue || 0;
  var idx_end = self.limitValue ? (self.limitValue + idx_start) : results.length;
  return results.slice(idx_start, idx_end);
};/*!
 * Monglo
 * Copyright (c) 2012 Christian Sullivan <cs@euforic.co>
 * MIT Licensed
 */
var Monglo = function(databaseName) {

  if(!(this instanceof Monglo)) return new Monglo(databaseName);

  this._collections = {};
  this._stores = [];

  if(!Monglo.connections) { Monglo.connections = {}; }

  //Temp patch until I figure out how far I want to take the implementation;

  if(Monglo.connections[databaseName]){
    throw new Error('db name already in use');
  }

  this.databaseName = databaseName;

  Monglo.connections[databaseName] = new ObjectID();

  // Ensure we have a valid db name
  validateDatabaseName(databaseName);

};


Monglo.prototype.__proto__ = EventEmitter.proto;

Monglo.prototype.constructor = Monglo;

/**
 * version Number
 */

Monglo.version = '0.1.2';

Monglo._debug = function(){
};

/**
 * Connection Pool
 * @type {Array}
 */

Monglo.connections = {};

/**
 * Persistance Plugins
 * @param  {[type]} name [description]
 * @param  {[type]} args [description]
 * @return {[type]}      [description]
 */
Monglo.prototype._executeCommand = function(name,args,cb){
  var self = this;
  var command = name;

  utils.forEach(self._stores,function(fn){
    if('function' === typeof fn[command]){
      fn[command](self,args,cb);
    } else if('function' === typeof fn.all){
      args.name = name;
      fn.all(self,args,cb);
    }
  });
};

/**
 * Middleware functions
 * @param  {[type]}   name [description]
 * @param  {Function} fn   [description]
 * @return {[type]}        [description]
 */

Monglo.prototype.use = function(name,fn){
 switch(name){
  case 'sync':
    this._sync = fn;
    break;
  case 'store':
    this._stores.push(fn);
    break;
  case 'debug':
    Monglo._debug = fn;
    break;
  }
};

/**
 * Stores for remote and local persistence
 *
 * @param {[type]} store [description]
 * @return {Monglo} Current Instance
 * @api public
 */

Monglo.prototype.addStore = function(store){
  this._stores.push(store);
  return this;
};

/**
 * Returns a cursor to all the collection information.
 *
 * @param {String} [collectionName] the collection name we wish to retrieve the information from.
 * @param {Function} callback returns option results.
 * @return {null}
 * @api public
 */

Monglo.prototype.collectionsInfo = function(collectionName, callback) {
};

/**
 * Get the list of all collection names for the specified db
 *
 * Options
 *  - **namesOnly** {String, default:false}, Return only the full collection namespace.
 *
 * @param {String} [collectionName] the collection name we wish to filter by.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback returns option results.
 * @return {null}
 * @api public
 */

Monglo.prototype.collectionNames = function(collectionName, options, callback) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 0);
  callback = args.pop();
  collectionName = args.length ? args.shift() : null;
  options = args.length ? args.shift() : {};

  var collectionList =[];
  for(var name in self._collections){
    collectionList.push(name);
  }
  callback(null,collectionList);
};


Monglo.prototype.collection = function(collectionName, options, callback) {
  var self = this;
  var collection;
  var collectionFullName =  self.databaseName + "." + collectionName;
  if('function' === typeof options){ options = {}; callback = options; } else{
    options = options || {};
  }

  if(self._collections[collectionName]){
    self._executeCommand('createCollection', {conn: self, collection:self._collections[collectionName]});
    return callback(null, self._collections[collectionName]);
  } else {
    self._collections[collectionName] = new Collection(self, collectionName, self.pkFactory, options);
    self._executeCommand('createCollection', {conn: self, collection:self._collections[collectionName]});
  }
    Object.defineProperty(Monglo.prototype, collectionName, {
      enumerable: true
    , get: function () {
        return self._collections[collectionName];
      }
    , set: function (v) {
        self._collections[collectionName] = v;
      }
  });

  return (callback) ? callback(self._collections[collectionName]) : self._collections[collectionName];
};

/**
 * Fetch all collections for the current Monglo.
 *
 * @param {Function} callback returns the results.
 * @return {null}
 * @api public
 */
Monglo.prototype.collections = function(callback) {
  var self = this;
  // Let's get the collection names
  self.collectionNames(function(err, documents) {
    if(err != null) return callback(err, null);
    var collections = [];
    utils.forEach(documents,function(document) {
      collections.push(new Collection(self, document.name.replace(self.databaseName + ".", ''), self.pkFactory));
    });
    // Return the collection objects
    callback(null, collections);
  });
};

/**
 * Dereference a dbref, against a db
 *
 * @param {DBRef} dbRef db reference object we wish to resolve.
 * @param {Function} callback returns the results.
 * @return {null}
 * @api public
 */
Monglo.prototype.dereference = function(dbRef, callback) {
  var db = this;
  // If we have a db reference then let's get the db first
  if(dbRef.db !== null) db = this.db(dbRef.db);
  // Fetch the collection and find the reference
  var collection = Monglo.collection(dbRef.namespace);
  collection.findOne({'_id':dbRef.oid}, function(err, result) {
    callback(err, result);
  });
};

/**
 * Creates a collection on a server pre-allocating space, need to create f.ex capped collections.
 *
 * Options
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a getLastError command returning the results of the command on MongoMonglo.
 *  - **serializeFunctions** {Boolean, default:false}, serialize functions on the document.
 *  - **raw** {Boolean, default:false}, perform all operations using raw bson objects.
 *  - **pkFactory** {Object}, object overriding the basic ObjectID primary key generation.
 *  - **capped** {Boolean, default:false}, create a capped collection.
 *  - **size** {Number}, the size of the capped collection in bytes.
 *  - **max** {Number}, the maximum number of documents in the capped collection.
 *  - **autoIndexId** {Boolean, default:false}, create an index on the _id field of the document, not created automatically on capped collections.
 *  - **readPreference** {String}, the prefered read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 *
 * @param {String} collectionName the collection name we wish to access.
 * @param {Object} [options] returns option results.
 * @param {Function} callback returns the results.
 * @return {null}
 * @api public
 */
Monglo.prototype.createCollection = Monglo.prototype.collection;

/**
 * Drop a collection from the database, removing it permanently. New accesses will create a new collection.
 *
 * @param {String} collectionName the name of the collection we wish to drop.
 * @param {Function} callback returns the results.
 * @return {null}
 * @api public
 */
Monglo.prototype.dropCollection = function(collectionName, callback) {
  var self = this;
  // Drop the collection
  this._executeCommand('dropCollection', {conn: this, collection: self });
};

/**
 * Rename a collection.
 *
 * @param {String} fromCollection the name of the current collection we wish to rename.
 * @param {String} toCollection the new name of the collection.
 * @param {Function} callback returns the results.
 * @return {null}
 * @api public
 */
Monglo.prototype.renameCollection = function(fromCollection, toCollection, callback) {
  var self = this;
  // Execute the command, return the new renamed collection if successful
  this._executeCommand('renameCollection', {conn: self, from: fromCollection, to: toCollection});
};


/**
 * Creates an index on the collection.
 *
 * Options
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a
 *  - **unique** {Boolean, default:false}, creates an unique index.
 *  - **sparse** {Boolean, default:false}, creates a sparse index.
 *  - **background** {Boolean, default:false}, creates the index in the background, yielding whenever possible.
 *  - **dropDups** {Boolean, default:false}, a unique index cannot be created on a key that has pre-existing duplicate values. If you would like to create the index anyway, keeping the first document the database indexes and deleting all subsequent documents that have duplicate value
 *  - **min** {Number}, for geospatial indexes set the lower bound for the co-ordinates.
 *  - **max** {Number}, for geospatial indexes set the high bound for the co-ordinates.
 *  - **v** {Number}, specify the format version of the indexes.
 *  - **expireAfterSeconds** {Number}, allows you to expire data on indexes applied to a data (MongoDB 2.2 or higher)
 *  - **name** {String}, override the autogenerated index name (useful if the resulting name is larger than 128 bytes)
 *
 * @param {String} collectionName name of the collection to create the index on.
 * @param {Object} fieldOrSpec fieldOrSpec that defines the index.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback for results.
 * @return {null}
 * @api public
 */
Monglo.prototype.createIndex = function(collectionName, fieldOrSpec, options, callback) {
  throw new Error('Not implemented yet!');
};

/**
 * Ensures that an index exists, if it does not it creates it
 *
 * Options
 *  - **safe** {true | {w:n, wtimeout:n} | {fsync:true}, default:false}, executes with a
 *  - **unique** {Boolean, default:false}, creates an unique index.
 *  - **sparse** {Boolean, default:false}, creates a sparse index.
 *  - **background** {Boolean, default:false}, creates the index in the background, yielding whenever possible.
 *  - **dropDups** {Boolean, default:false}, a unique index cannot be created on a key that has pre-existing duplicate values. If you would like to create the index anyway, keeping the first document the database indexes and deleting all subsequent documents that have duplicate value
 *  - **min** {Number}, for geospatial indexes set the lower bound for the co-ordinates.
 *  - **max** {Number}, for geospatial indexes set the high bound for the co-ordinates.
 *  - **v** {Number}, specify the format version of the indexes.
 *  - **expireAfterSeconds** {Number}, allows you to expire data on indexes applied to a data (MongoDB 2.2 or higher)
 *  - **name** {String}, override the autogenerated index name (useful if the resulting name is larger than 128 bytes)
 *
 * @param {String} collectionName name of the collection to create the index on.
 * @param {Object} fieldOrSpec fieldOrSpec that defines the index.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback for results.
 * @return {null}
 * @api public
 */
Monglo.prototype.ensureIndex = function(collectionName, fieldOrSpec, options, callback) {
  throw new Error('Not implemented yet!');
};

/**
 * Drop an index on a collection.
 *
 * @param {String} collectionName the name of the collection where the command will drop an index.
 * @param {String} indexName name of the index to drop.
 * @param {Function} callback for results.
 * @return {null}
 * @api public
 */
Monglo.prototype.dropIndex = function(collectionName, indexName, callback) {
  throw new Error('Not implemented yet!');
};

/**
 * Reindex all indexes on the collection
 * Warning: reIndex is a blocking operation (indexes are rebuilt in the foreground) and will be slow for large collections.
 *
 * @param {String} collectionName the name of the collection.
 * @param {Function} callback returns the results.
 * @api public
**/
Monglo.prototype.reIndex = function(collectionName, callback) {
  throw new Error('Not implemented yet!');
};

/**
 * Retrieves this collections index info.
 *
 * Options
 *  - **full** {Boolean, default:false}, returns the full raw index information.
 *  - **readPreference** {String}, the preferred read preference ((Server.PRIMARY, Server.PRIMARY_PREFERRED, Server.SECONDARY, Server.SECONDARY_PREFERRED, Server.NEAREST).
 *
 * @param {String} collectionName the name of the collection.
 * @param {Object} [options] additional options during update.
 * @param {Function} callback returns the index information.
 * @return {null}
 * @api public
 */
Monglo.prototype.indexInformation = function(collectionName, options, callback) {
   throw new Error('Not implemented yet!');
};

/**
 * Drop a database.
 *
 * @param {Function} callback returns the index information.
 * @return {null}
 * @api public
 */
Monglo.prototype.dropDatabase = function(callback) {
  var self = this;
  this._executeCommand('dropDatabase', {conn:this });
};

exports.Monglo = Monglo;

/**
 * @ignore
 */
function validateDatabaseName(databaseName) {
  if(typeof databaseName !== 'string') throw new Error("database name must be a string");
  if(databaseName.length === 0) throw new Error("database name cannot be the empty string");

  var invalidChars = [" ", ".", "$", "/", "\\"];
  for(var i = 0; i < invalidChars.length; i++) {
    if(databaseName.indexOf(invalidChars[i]) != -1) throw new Error("database names cannot contain the character '" + invalidChars[i] + "'");
  }
}/**
 * Module dependencies.
 */
/**
 * Binary Parser.
 * Jonas Raoni Soares Silva
 * http://jsfromhell.com/classes/binary-parser [v1.0]
 */
var chr = String.fromCharCode;

var maxBits = [];
for (var i = 0; i < 64; i++) {
  maxBits[i] = Math.pow(2, i);
}

function BinaryParser (bigEndian, allowExceptions) {
  if(!(this instanceof BinaryParser)) return new BinaryParser(bigEndian, allowExceptions);
  
  this.bigEndian = bigEndian;
  this.allowExceptions = allowExceptions;
}

BinaryParser.warn = function warn (msg) {
  if (this.allowExceptions) {
    throw new Error(msg);
  }

  return 1;
};

BinaryParser.decodeFloat = function decodeFloat (data, precisionBits, exponentBits) {
  var b = new this.Buffer(this.bigEndian, data);

  b.checkBuffer(precisionBits + exponentBits + 1);

  var bias = maxBits[exponentBits - 1] - 1
    , signal = b.readBits(precisionBits + exponentBits, 1)
    , exponent = b.readBits(precisionBits, exponentBits)
    , significand = 0
    , divisor = 2
    , curByte = b.buffer.length + (-precisionBits >> 3) - 1;

  do {
    for (var byteValue = b.buffer[ ++curByte ], startBit = precisionBits % 8 || 8, mask = 1 << startBit; mask >>= 1; ( byteValue & mask ) && ( significand += 1 / divisor ), divisor *= 2 );
  } while (precisionBits -= startBit);

  return exponent == ( bias << 1 ) + 1 ? significand ? NaN : signal ? -Infinity : +Infinity : ( 1 + signal * -2 ) * ( exponent || significand ? !exponent ? Math.pow( 2, -bias + 1 ) * significand : Math.pow( 2, exponent - bias ) * ( 1 + significand ) : 0 );
};

BinaryParser.decodeInt = function decodeInt (data, bits, signed, forceBigEndian) {
  var b = new this.Buffer(this.bigEndian || forceBigEndian, data)
      , x = b.readBits(0, bits)
      , max = maxBits[bits]; //max = Math.pow( 2, bits );
  
  return signed && x >= max / 2
      ? x - max
      : x;
};

BinaryParser.encodeFloat = function encodeFloat (data, precisionBits, exponentBits) {
  var bias = maxBits[exponentBits - 1] - 1
    , minExp = -bias + 1
    , maxExp = bias
    , minUnnormExp = minExp - precisionBits
    , n = parseFloat(data)
    , status = isNaN(n) || n == -Infinity || n == +Infinity ? n : 0
    , exp = 0
    , len = 2 * bias + 1 + precisionBits + 3
    , bin = new Array(len)
    , signal = (n = status !== 0 ? 0 : n) < 0
    , intPart = Math.floor(n = Math.abs(n))
    , floatPart = n - intPart
    , lastBit
    , rounded
    , result
    , i
    , j;

  for (i = len; i; bin[--i] = 0);

  for (i = bias + 2; intPart && i; bin[--i] = intPart % 2, intPart = Math.floor(intPart / 2));

  for (i = bias + 1; floatPart > 0 && i; (bin[++i] = ((floatPart *= 2) >= 1) - 0 ) && --floatPart);

  for (i = -1; ++i < len && !bin[i];);

  if (bin[(lastBit = precisionBits - 1 + (i = (exp = bias + 1 - i) >= minExp && exp <= maxExp ? i + 1 : bias + 1 - (exp = minExp - 1))) + 1]) {
    if (!(rounded = bin[lastBit])) {
      for (j = lastBit + 2; !rounded && j < len; rounded = bin[j++]);
    }

    for (j = lastBit + 1; rounded && --j >= 0; (bin[j] = !bin[j] - 0) && (rounded = 0));
  }

  for (i = i - 2 < 0 ? -1 : i - 3; ++i < len && !bin[i];);

  if ((exp = bias + 1 - i) >= minExp && exp <= maxExp) {
    ++i;
  } else if (exp < minExp) {
    exp != bias + 1 - len && exp < minUnnormExp && this.warn("encodeFloat::float underflow");
    i = bias + 1 - (exp = minExp - 1);
  }

  if (intPart || status !== 0) {
    this.warn(intPart ? "encodeFloat::float overflow" : "encodeFloat::" + status);
    exp = maxExp + 1;
    i = bias + 2;

    if (status == -Infinity) {
      signal = 1;
    } else if (isNaN(status)) {
      bin[i] = 1;
    }
  }

  for (n = Math.abs(exp + bias), j = exponentBits + 1, result = ""; --j; result = (n % 2) + result, n = n >>= 1);

  for (n = 0, j = 0, i = (result = (signal ? "1" : "0") + result + bin.slice(i, i + precisionBits).join("")).length, r = []; i; j = (j + 1) % 8) {
    n += (1 << j) * result.charAt(--i);
    if (j == 7) {
      r[r.length] = String.fromCharCode(n);
      n = 0;
    }
  }

  r[r.length] = n
    ? String.fromCharCode(n)
    : "";

  return (this.bigEndian ? r.reverse() : r).join("");
};

BinaryParser.encodeInt = function encodeInt (data, bits, signed, forceBigEndian) {
  var max = maxBits[bits];

  if (data >= max || data < -(max / 2)) {
    this.warn("encodeInt::overflow");
    data = 0;
  }

  if (data < 0) {
    data += max;
  }

  for (var r = []; data; r[r.length] = String.fromCharCode(data % 256), data = Math.floor(data / 256));

  for (bits = -(-bits >> 3) - r.length; bits--; r[r.length] = "\0");

  return ((this.bigEndian || forceBigEndian) ? r.reverse() : r).join("");
};

BinaryParser.toSmall    = function( data ){ return this.decodeInt( data,  8, true  ); };
BinaryParser.fromSmall  = function( data ){ return this.encodeInt( data,  8, true  ); };
BinaryParser.toByte     = function( data ){ return this.decodeInt( data,  8, false ); };
BinaryParser.fromByte   = function( data ){ return this.encodeInt( data,  8, false ); };
BinaryParser.toShort    = function( data ){ return this.decodeInt( data, 16, true  ); };
BinaryParser.fromShort  = function( data ){ return this.encodeInt( data, 16, true  ); };
BinaryParser.toWord     = function( data ){ return this.decodeInt( data, 16, false ); };
BinaryParser.fromWord   = function( data ){ return this.encodeInt( data, 16, false ); };
BinaryParser.toInt      = function( data ){ return this.decodeInt( data, 32, true  ); };
BinaryParser.fromInt    = function( data ){ return this.encodeInt( data, 32, true  ); };
BinaryParser.toLong     = function( data ){ return this.decodeInt( data, 64, true  ); };
BinaryParser.fromLong   = function( data ){ return this.encodeInt( data, 64, true  ); };
BinaryParser.toDWord    = function( data ){ return this.decodeInt( data, 32, false ); };
BinaryParser.fromDWord  = function( data ){ return this.encodeInt( data, 32, false ); };
BinaryParser.toQWord    = function( data ){ return this.decodeInt( data, 64, true ); };
BinaryParser.fromQWord  = function( data ){ return this.encodeInt( data, 64, true ); };
BinaryParser.toFloat    = function( data ){ return this.decodeFloat( data, 23, 8   ); };
BinaryParser.fromFloat  = function( data ){ return this.encodeFloat( data, 23, 8   ); };
BinaryParser.toDouble   = function( data ){ return this.decodeFloat( data, 52, 11  ); };
BinaryParser.fromDouble = function( data ){ return this.encodeFloat( data, 52, 11  ); };

// Factor out the encode so it can be shared by add_header and push_int32
BinaryParser.encode_int32 = function encode_int32 (number, asArray) {
  var a, b, c, d, unsigned;
  unsigned = (number < 0) ? (number + 0x100000000) : number;
  a = Math.floor(unsigned / 0xffffff);
  unsigned &= 0xffffff;
  b = Math.floor(unsigned / 0xffff);
  unsigned &= 0xffff;
  c = Math.floor(unsigned / 0xff);
  unsigned &= 0xff;
  d = Math.floor(unsigned);
  return asArray ? [chr(a), chr(b), chr(c), chr(d)] : chr(a) + chr(b) + chr(c) + chr(d);
};

BinaryParser.encode_int64 = function encode_int64 (number) {
  var a, b, c, d, e, f, g, h, unsigned;
  unsigned = (number < 0) ? (number + 0x10000000000000000) : number;
  a = Math.floor(unsigned / 0xffffffffffffff);
  unsigned &= 0xffffffffffffff;
  b = Math.floor(unsigned / 0xffffffffffff);
  unsigned &= 0xffffffffffff;
  c = Math.floor(unsigned / 0xffffffffff);
  unsigned &= 0xffffffffff;
  d = Math.floor(unsigned / 0xffffffff);
  unsigned &= 0xffffffff;
  e = Math.floor(unsigned / 0xffffff);
  unsigned &= 0xffffff;
  f = Math.floor(unsigned / 0xffff);
  unsigned &= 0xffff;
  g = Math.floor(unsigned / 0xff);
  unsigned &= 0xff;
  h = Math.floor(unsigned);
  return chr(a) + chr(b) + chr(c) + chr(d) + chr(e) + chr(f) + chr(g) + chr(h);
};

/**
 * UTF8 methods
 */

// Take a raw binary string and return a utf8 string
BinaryParser.decode_utf8 = function decode_utf8 (binaryStr) {
  var len = binaryStr.length
    , decoded = ''
    , i = 0
    , c = 0
    , c1 = 0
    , c2 = 0
    , c3;

  while (i < len) {
    c = binaryStr.charCodeAt(i);
    if (c < 128) {
      decoded += String.fromCharCode(c);
      i++;
    } else if ((c > 191) && (c < 224)) {
      c2 = binaryStr.charCodeAt(i+1);
      decoded += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      i += 2;
    } else {
      c2 = binaryStr.charCodeAt(i+1);
      c3 = binaryStr.charCodeAt(i+2);
      decoded += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      i += 3;
    }
  }

  return decoded;
};

// Encode a cstring
BinaryParser.encode_cstring = function encode_cstring (s) {
  return unescape(encodeURIComponent(s)) + BinaryParser.fromByte(0);
};

// Take a utf8 string and return a binary string
BinaryParser.encode_utf8 = function encode_utf8 (s) {
  var a = ""
    , c;

  for (var n = 0, len = s.length; n < len; n++) {
    c = s.charCodeAt(n);

    if (c < 128) {
      a += String.fromCharCode(c);
    } else if ((c > 127) && (c < 2048)) {
      a += String.fromCharCode((c>>6) | 192) ;
      a += String.fromCharCode((c&63) | 128);
    } else {
      a += String.fromCharCode((c>>12) | 224);
      a += String.fromCharCode(((c>>6) & 63) | 128);
      a += String.fromCharCode((c&63) | 128);
    }
  }

  return a;
};

BinaryParser.hprint = function hprint (s) {
  var number;

  for (var i = 0, len = s.length; i < len; i++) {
    if (s.charCodeAt(i) < 32) {
      number = s.charCodeAt(i) <= 15
        ? "0" + s.charCodeAt(i).toString(16)
        : s.charCodeAt(i).toString(16);        
      process.stdout.write(number + " ")
    } else {
      number = s.charCodeAt(i) <= 15
        ? "0" + s.charCodeAt(i).toString(16)
        : s.charCodeAt(i).toString(16);
        process.stdout.write(number + " ")
    }
  }
  
  process.stdout.write("\n\n");
};

BinaryParser.ilprint = function hprint (s) {
  var number;

  for (var i = 0, len = s.length; i < len; i++) {
    if (s.charCodeAt(i) < 32) {
      number = s.charCodeAt(i) <= 15
        ? "0" + s.charCodeAt(i).toString(10)
        : s.charCodeAt(i).toString(10);

    } else {
      number = s.charCodeAt(i) <= 15
        ? "0" + s.charCodeAt(i).toString(10)
        : s.charCodeAt(i).toString(10);
    }
  }
};

BinaryParser.hlprint = function hprint (s) {
  var number;

  for (var i = 0, len = s.length; i < len; i++) {
    if (s.charCodeAt(i) < 32) {
      number = s.charCodeAt(i) <= 15
        ? "0" + s.charCodeAt(i).toString(16)
        : s.charCodeAt(i).toString(16);
    } else {
      number = s.charCodeAt(i) <= 15
        ? "0" + s.charCodeAt(i).toString(16)
        : s.charCodeAt(i).toString(16);
    }
  }
};

/**
 * BinaryParser buffer constructor.
 */
function BinaryParserBuffer (bigEndian, buffer) {
  this.bigEndian = bigEndian || 0;
  this.buffer = [];
  this.setBuffer(buffer);
};

BinaryParserBuffer.prototype.setBuffer = function setBuffer (data) {
  var l, i, b;

  if (data) {
    i = l = data.length;
    b = this.buffer = new Array(l);
    for (; i; b[l - i] = data.charCodeAt(--i));
    this.bigEndian && b.reverse();
  }
};

BinaryParserBuffer.prototype.hasNeededBits = function hasNeededBits (neededBits) {
  return this.buffer.length >= -(-neededBits >> 3);
};

BinaryParserBuffer.prototype.checkBuffer = function checkBuffer (neededBits) {
  if (!this.hasNeededBits(neededBits)) {
    throw new Error("checkBuffer::missing bytes");
  }
};

BinaryParserBuffer.prototype.readBits = function readBits (start, length) {
  //shl fix: Henri Torgemane ~1996 (compressed by Jonas Raoni)

  function shl (a, b) {
    for (; b--; a = ((a %= 0x7fffffff + 1) & 0x40000000) == 0x40000000 ? a * 2 : (a - 0x40000000) * 2 + 0x7fffffff + 1);
    return a;
  }

  if (start < 0 || length <= 0) {
    return 0;
  }

  this.checkBuffer(start + length);

  var offsetLeft
    , offsetRight = start % 8
    , curByte = this.buffer.length - ( start >> 3 ) - 1
    , lastByte = this.buffer.length + ( -( start + length ) >> 3 )
    , diff = curByte - lastByte
    , sum = ((this.buffer[ curByte ] >> offsetRight) & ((1 << (diff ? 8 - offsetRight : length)) - 1)) + (diff && (offsetLeft = (start + length) % 8) ? (this.buffer[lastByte++] & ((1 << offsetLeft) - 1)) << (diff-- << 3) - offsetRight : 0);

  for(; diff; sum += shl(this.buffer[lastByte++], (diff-- << 3) - offsetRight));

  return sum;
};

/**
 * Expose.
 */
BinaryParser.Buffer = BinaryParserBuffer;

if(typeof window === 'undefined') {
  exports.BinaryParser = BinaryParser;
}

/**
 * ObjectId
 */

/**
 * Machine id.
 *
 * Create a random 3-byte value (i.e. unique for this
 * process). Other drivers use a md5 of the machine id here, but
 * that would mean an asyc call to gethostname, so we don't bother.
 */
var MACHINE_ID = parseInt(Math.random() * 0xFFFFFF, 10);

// Regular expression that checks for hex value
var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");

/**
* Create a new ObjectID instance
*
* @class Represents the BSON ObjectID type
* @param {String|Number} id Can be a 24 byte hex string, 12 byte binary string or a Number.
* @return {Object} instance of ObjectID.
*/
var ObjectID = function ObjectID(id, _hex) {
  if(!(this instanceof ObjectID)) return new ObjectID(id, _hex);

  this._bsontype = 'ObjectID';
  var __id = null;

  // Throw an error if it's not a valid setup
  if(id != null && 'number' != typeof id && (id.length != 12 && id.length != 24))
    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");

  // Generate id based on the input
  if(id == null || typeof id == 'number') {
    // convert to 12 byte binary string
    this.id = this.generate(id);
  } else if(id != null && id.length === 12) {
    // assume 12 byte string
    this.id = id;
  } else if(checkForHexRegExp.test(id)) {
    return ObjectID.createFromHexString(id);
  } else if(!checkForHexRegExp.test(id)) {
    throw new Error("Value passed in is not a valid 24 character hex string");
  }

  if(ObjectID.cacheHexString) this.__id = this.toHexString();
};

// Is this a bad Idea?
//ObjectID.prototype.__proto__.toString = function() { return '[ObjectId Object]'; };

// Allow usage of ObjectId aswell as ObjectID
var ObjectId = ObjectID;

/**
* Return the ObjectID id as a 24 byte hex string representation
*
* @return {String} return the 24 byte hex string representation.
* @api public
*/
ObjectID.prototype.toHexString = function() {
  if(ObjectID.cacheHexString && this.__id) return this.__id;

  var hexString = ''
    , number
    , value;

  for (var index = 0, len = this.id.length; index < len; index++) {
    value = BinaryParser.toByte(this.id[index]);
    number = value <= 15
      ? '0' + value.toString(16)
      : value.toString(16);
    hexString = hexString + number;
  }

  if(ObjectID.cacheHexString) this.__id = hexString;
  return hexString;
};

/**
* Update the ObjectID index used in generating new ObjectID's on the driver
*
* @return {Number} returns next index value.
* @api private
*/
ObjectID.prototype.get_inc = function() {
  return ObjectID.index = (ObjectID.index + 1) % 0xFFFFFF;
};

/**
* Update the ObjectID index used in generating new ObjectID's on the driver
*
* @return {Number} returns next index value.
* @api private
*/
ObjectID.prototype.getInc = function() {
  return this.get_inc();
};

/**
* Generate a 12 byte id string used in ObjectID's
*
* @param {Number} [time] optional parameter allowing to pass in a second based timestamp.
* @return {String} return the 12 byte id binary string.
* @api private
*/
ObjectID.prototype.generate = function(time) {
  if ('number' == typeof time) {
    var time4Bytes = BinaryParser.encodeInt(time, 32, true, true);
    /* for time-based ObjectID the bytes following the time will be zeroed */
    var machine3Bytes = BinaryParser.encodeInt(MACHINE_ID, 24, false);
    var pid2Bytes = BinaryParser.fromShort(typeof process === 'undefined' ? Math.floor(Math.random() * 100000) : process.pid);
    var index3Bytes = BinaryParser.encodeInt(this.get_inc(), 24, false, true);
  } else {
    var unixTime = parseInt(Date.now()/1000,10);
    var time4Bytes = BinaryParser.encodeInt(unixTime, 32, true, true);
    var machine3Bytes = BinaryParser.encodeInt(MACHINE_ID, 24, false);
    var pid2Bytes = BinaryParser.fromShort(typeof process === 'undefined' ? Math.floor(Math.random() * 100000) : process.pid);
    var index3Bytes = BinaryParser.encodeInt(this.get_inc(), 24, false, true);
  }

  return time4Bytes + machine3Bytes + pid2Bytes + index3Bytes;
};

/**
* Converts the id into a 24 byte hex string for printing
*
* @return {String} return the 24 byte hex string representation.
* @api private
*/
ObjectID.prototype.toString = function() {
  return this.toHexString();
};

/**
* Converts to a string representation of this Id.
*
* @return {String} return the 24 byte hex string representation.
* @api private
*/
ObjectID.prototype.inspect = ObjectID.prototype.toString;

/**
* Converts to its JSON representation.
*
* @return {String} return the 24 byte hex string representation.
* @api private
*/
ObjectID.prototype.toJSON = function() {
  return this.toHexString();
};

/**
* Compares the equality of this ObjectID with `otherID`.
*
* @param {Object} otherID ObjectID instance to compare against.
* @return {Bool} the result of comparing two ObjectID's
* @api public
*/
ObjectID.prototype.equals = function equals (otherID) {
  var id = (otherID instanceof ObjectID || otherID.toHexString)
    ? otherID.id
    : ObjectID.createFromHexString(otherID).id;

  return this.id === id;
}

/**
* Returns the generation time in seconds that this ID was generated.
*
* @return {Number} return number of seconds in the timestamp part of the 12 byte id.
* @api public
*/
ObjectID.prototype.getTimestamp = function() {
  var timestamp = new Date();
  timestamp.setTime(Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true)) * 1000);
  return timestamp;
}

/**
* @ignore
* @api private
*/
ObjectID.index = 0;

ObjectID.createPk = function createPk () {
  return new ObjectID();
};

/**
* Creates an ObjectID from a second based number, with the rest of the ObjectID zeroed out. Used for comparisons or sorting the ObjectID.
*
* @param {Number} time an integer number representing a number of seconds.
* @return {ObjectID} return the created ObjectID
* @api public
*/
ObjectID.createFromTime = function createFromTime (time) {
  var id = BinaryParser.encodeInt(time, 32, true, true) +
           BinaryParser.encodeInt(0, 64, true, true);
  return new ObjectID(id);
};

/**
* Creates an ObjectID from a hex string representation of an ObjectID.
*
* @param {String} hexString create a ObjectID from a passed in 24 byte hexstring.
* @return {ObjectID} return the created ObjectID
* @api public
*/
ObjectID.createFromHexString = function createFromHexString (hexString) {
  // Throw an error if it's not a valid setup
  if(typeof hexString === 'undefined' || hexString != null && hexString.length != 24)
    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");

  var len = hexString.length;

  if(len > 12*2) {
    throw new Error('Id cannot be longer than 12 bytes');
  }

  var result = ''
    , string
    , number;

  for (var index = 0; index < len; index += 2) {
    string = hexString.substr(index, 2);
    number = parseInt(string, 16);
    result += BinaryParser.fromByte(number);
  }

  return new ObjectID(result, hexString);
};

/**
* @ignore
*/
Object.defineProperty(ObjectID.prototype, "generationTime", {
   enumerable: true
 , get: function () {
     return Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true));
   }
 , set: function (value) {
     var value = BinaryParser.encodeInt(value, 32, true, true);
     this.id = value + this.id.substr(4);
     // delete this.__id;
     this.toHexString();
   }
});

/**
 * Expose.
 */
  exports.ObjectID = ObjectID;
  exports.ObjectId = ObjectID;
// XXX type checking on selectors (graceful error if malformed)

// Collection: a set of documents that supports queries and modifiers.

// Cursor: a specification for a particular subset of documents, w/
// a defined order, limit, and offset.  creating a Cursor with Collection.find(),

// LiveResultsSet: the return value of a live query.

function Collection (db, collectionName, pkFactory, options) {
   if(!(this instanceof Collection)) return new Collection(db, collectionName, pkFactory, options);

  checkCollectionName(collectionName);

  this.db = db;
  this.collectionName = collectionName;
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
  this.db._executeCommand('find', {conn:self.db,selector:selector,options:o});
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

  if (!('_id' in doc)){
    doc._id = new ObjectId();
  }
  doc.timestamp = new ObjectId().generationTime;
  self.docs[doc._id] = doc;

  // trigger live queries that match
  for (var qid in self.queries) {
    var query = self.queries[qid];
    if (query.selector_f(doc))
      Collection._insertInResults(query, doc);
  }
// Hack to prevent updates from registering as inserts also
 if(options.ignore){  return (cb) ? cb(doc) : doc; }

 self.emit('insert',doc);
 this.db._executeCommand('insert',{conn:self.db, collection:self, doc:self.docs[doc._id]});
 return (cb) ? cb(doc) : doc;
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
  this.db._executeCommand('remove',{conn:self.db, selector:selector, docs:remove});
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
        self.db._executeCommand('update',{conn:self.db, selector:selector, modifier:mod, options:options, docs:updatedDocs });
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

  self.emit('update', selector, mod, options);
  self.db._executeCommand('update',{conn:self.db, selector:selector, modifier:mod, options:options, docs:newDoc });
  return (cb) ? cb(newDoc) : newDoc;
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
};// old_results: array of documents.
// new_results: array of documents.
// observer: object with 'added', 'changed', 'moved',
//           'removed' functions (each optional)
// deepcopy: if true, elements of new_results that are passed to callbacks are
//          deepcopied first
Collection._diffQuery = function (old_results, new_results, observer, deepcopy) {

  var new_presence_of_id = {};
  _.each(new_results, function (doc) {
    if (new_presence_of_id[doc._id])
      utils.debug("Duplicate _id in new_results");
    new_presence_of_id[doc._id] = true;
  });

  var old_index_of_id = {};
  _.each(old_results, function (doc, i) {
    if (doc._id in old_index_of_id)
      utils.debug("Duplicate _id in old_results");
    old_index_of_id[doc._id] = i;
  });

  // "maybe deepcopy"
  var mdc = (deepcopy ? Collection._deepcopy : _.identity);

  // ALGORITHM:
  //
  // We walk old_idx through the old_results array and
  // new_idx through the new_results array at the same time.
  // These pointers establish a sort of correspondence between
  // old docs and new docs (identified by their _ids).
  // If they point to the same doc (i.e. old and new docs
  // with the same _id), we can increment both pointers
  // and fire no 'moved' callbacks.  Otherwise, we must
  // increment one or the other and fire approprate 'added',
  // 'removed', and 'moved' callbacks.
  //
  // The process is driven by new_results, in that we try
  // make the observer's array look like new_results by
  // establishing each new doc in order.  The doc pointed
  // to by new_idx is the one we are trying to establish
  // at any given time.  If it doesn't exist in old_results,
  // we fire an 'added' callback.  If it does, we have a
  // choice of two ways to handle the situation.  We can
  // advance old_idx forward to the corresponding old doc,
  // treating all intervening old docs as moved or removed,
  // and the current doc as unmoved.  Or, we can simply
  // establish the new doc as next by moving it into place,
  // i.e. firing a single 'moved' callback to move the
  // doc from wherever it was before.  Generating a sequence
  // of 'moved' callbacks that is not just correct but small
  // (or minimal) is a matter of choosing which elements
  // to consider moved and which ones merely change position
  // by virtue of the movement of other docs.
  //
  // Calling callbacks with correct indices requires understanding
  // what the observer's array looks like at each iteration.
  // The observer's array is a concatenation of:
  // - new_results up to (but not including) new_idx, with the
  //   addition of some "bumped" docs that we are later going
  //   to move into place
  // - old_results starting at old_idx, minus any docs that we
  //   have already moved ("taken" docs)
  //
  // To keep track of "bumped" items -- docs in the observer's
  // array that we have skipped over, but will be moved forward
  // later when we get to their new position -- we keep a
  // "bump list" of indices into new_results where bumped items
  // occur.  [The idea is that by adding an item to the list (bumping
  // it), we can consider it dealt with, even though it is still there.]
  // The corresponding position of new_idx in the observer's array,
  // then, is new_idx + bump_list.length, and the position of
  // the nth bumped item in the observer's array is
  // bump_list[n] + n (to account for the previous bumped items
  // that are still there).
  //
  // A "taken" list is used in a sort of analogous way to track
  // the indices of the documents after old_idx in old_results
  // that we have moved, so that, conversely, even though we will
  // come across them in old_results, they are actually no longer
  // in the observer's array.
  //
  // To determine which docs should be considered "moved" (and which
  // merely change position because of other docs moving) we run
  // a "longest common subsequence" (LCS) algorithm.  The LCS of the
  // old doc IDs and the new doc IDs gives the docs that should NOT be
  // considered moved.
  //
  // Overall, this diff implementation is asymptotically good, but could
  // be optimized to streamline execution and use less memory (e.g. not
  // have to build data structures with an entry for every doc).

  // Asymptotically: O(N k) where k is number of ops, or potentially
  // O(N log N) if inner loop of LCS were made to be binary search.


  //////// LCS (longest common sequence, with respect to _id)
  // (see Wikipedia article on Longest Increasing Subsequence,
  // where the LIS is taken of the sequence of old indices of the
  // docs in new_results)
  //
  // unmoved_set: the output of the algorithm; members of the LCS,
  // in the form of indices into new_results
  var unmoved_set = {};
  // max_seq_len: length of LCS found so far
  var max_seq_len = 0;
  // seq_ends[i]: the index into new_results of the last doc in a
  // common subsequence of length of i+1 <= max_seq_len
  var N = new_results.length;
  var seq_ends = new Array(N);
  // ptrs:  the common subsequence ending with new_results[n] extends
  // a common subsequence ending with new_results[ptr[n]], unless
  // ptr[n] is -1.
  var ptrs = new Array(N);
  // virtual sequence of old indices of new results
  var old_idx_seq = function(i_new) {
    return old_index_of_id[new_results[i_new]._id];
  };
  // for each item in new_results, use it to extend a common subsequence
  // of length j <= max_seq_len
  for(var i=0; i<N; i++) {
    if (old_index_of_id[new_results[i]._id] !== undefined) {
      var j = max_seq_len;
      // this inner loop would traditionally be a binary search,
      // but scanning backwards we will likely find a subseq to extend
      // pretty soon, bounded for example by the total number of ops.
      // If this were to be changed to a binary search, we'd still want
      // to scan backwards a bit as an optimization.
      while (j > 0) {
        if (old_idx_seq(seq_ends[j-1]) < old_idx_seq(i))
          break;
        j--;
      }

      ptrs[i] = (j === 0 ? -1 : seq_ends[j-1]);
      seq_ends[j] = i;
      if (j+1 > max_seq_len)
        max_seq_len = j+1;
    }
  }

  // pull out the LCS/LIS into unmoved_set
  var idx = (max_seq_len === 0 ? -1 : seq_ends[max_seq_len-1]);
  while (idx >= 0) {
    unmoved_set[idx] = true;
    idx = ptrs[idx];
  }

  //////// Main Diff Algorithm

  var old_idx = 0;
  var new_idx = 0;
  var bump_list = [];
  var bump_list_old_idx = [];
  var taken_list = [];

  var scan_to = function(old_j) {
    // old_j <= old_results.length (may scan to end)
    while (old_idx < old_j) {
      var old_doc = old_results[old_idx];
      var is_in_new = new_presence_of_id[old_doc._id];
      if (! is_in_new) {
        observer.removed && observer.removed(old_doc, new_idx + bump_list.length);
      } else {
        if (taken_list.length >= 1 && taken_list[0] === old_idx) {
          // already moved
          taken_list.shift();
        } else {
          // bump!
          bump_list.push(new_idx);
          bump_list_old_idx.push(old_idx);
        }
      }
      old_idx++;
    }
  };


  while (new_idx <= new_results.length) {
    if (new_idx < new_results.length) {
      var new_doc = new_results[new_idx];
      var old_doc_idx = old_index_of_id[new_doc._id];
      if (old_doc_idx === undefined) {
        // insert
        observer.added && observer.added(mdc(new_doc), new_idx + bump_list.length);
      } else {
        var old_doc = old_results[old_doc_idx];
        //var is_unmoved = (old_doc_idx > old_idx); // greedy; not minimal
        var is_unmoved = unmoved_set[new_idx];
        if (is_unmoved) {
          if (old_doc_idx < old_idx)
            utils.debug("Assertion failed while diffing: nonmonotonic lcs data");
          // no move
          scan_to(old_doc_idx);
          if (! _.isEqual(old_doc, new_doc)) {
            observer.changed && observer.changed(
              mdc(new_doc), new_idx + bump_list.length, old_doc);
          }
          old_idx++;
        } else {
          // move into place
          var to_idx = new_idx + bump_list.length;
          var from_idx;
          if (old_doc_idx >= old_idx) {
            // move backwards
            from_idx = to_idx + old_doc_idx - old_idx;
            // must take number of "taken" items into account; also use
            // results of this binary search to insert new taken_list entry
            var num_taken_before = _.sortedIndex(taken_list, old_doc_idx);
            from_idx -= num_taken_before;
            taken_list.splice(num_taken_before, 0, old_doc_idx);
          } else {
            // move forwards, from bump list
            // (binary search applies)
            var b = _.indexOf(bump_list_old_idx, old_doc_idx, true);
            if (b < 0)
              utils.debug("Assertion failed while diffing: no bumped item");
            from_idx = bump_list[b] + b;
            to_idx--;
            bump_list.splice(b, 1);
            bump_list_old_idx.splice(b, 1);
          }
          if (from_idx != to_idx)
            observer.moved && observer.moved(mdc(old_doc), from_idx, to_idx);
          if (! _.isEqual(old_doc, new_doc)) {
            observer.changed && observer.changed(mdc(new_doc), to_idx, old_doc);
          }
        }
      }
    } else {
      scan_to(old_results.length);
    }
    new_idx++;
  }
  if (bump_list.length > 0) {
    utils.debug(old_results);
    utils.debug(new_results);
    utils.debug("Assertion failed while diffing: leftover bump_list "+
                  bump_list);
  }

};var isArray = Array.isArray;
var domain;

function EventEmitter() {}

exports.EventEmitter = EventEmitter;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._maxListeners = n;
};


EventEmitter.prototype.emit = function() {
  var type = arguments[0];
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {

      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var l = arguments.length;
        var args = new Array(l - 1);
        for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var l = arguments.length;
    var args = new Array(l - 1);
    for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, typeof listener.listener === 'function' ?
            listener.listener : listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // If we've already got an array, just append.
    this._events[type].push(listener);

  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  }

  // Check for listener leak
  if (isArray(this._events[type]) && !this._events[type].warned) {
    var m;
    if (this._maxListeners !== undefined) {
      m = this._maxListeners;
    } else {
      m = defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('.once only takes instances of Function');
  }

  var self = this;
  function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  };

  g.listener = listener;
  self.on(type, g);

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var position = -1;
    for (var i = 0, length = list.length; i < length; i++) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener))
      {
        position = i;
        break;
      }
    }

    if (position < 0) return this;
    list.splice(position, 1);
  } else if (list === listener ||
             (list.listener && list.listener === listener))
  {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  if (arguments.length === 0) {
    this._events = {};
    return this;
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};// XXX need a strategy for passing the binding of $ into this
// function, from the compiled selector
//
// maybe just {key.up.to.just.before.dollarsign: array_index}
//
// XXX atomicity: if one modification fails, do we roll back the whole
// change?
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
    var new_doc = Collection._deepcopy(doc);

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
    target[field] = Collection._deepcopy(arg);
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
      x.push(Collection._deepcopy(arg));
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
};var Selector = {};

// helpers used by compiled selector code
Selector._f = {
  // TODO for _all and _in, consider building 'inquery' at compile time..

  _all: function (x, qval) {
    // $all is only meaningful on arrays
    if (!(x instanceof Array)) {
      return false;
    }
    // TODO should use a canonicalizing representation, so that we
    // don't get screwed by key order
    var parts = {};
    var remaining = 0;
    utils.each(qval, function (q) {
      var hash = JSON.stringify(q);
      if (!(hash in parts)) {
        parts[hash] = true;
        remaining++;
      }
    });

    for (var i = 0; i < x.length; i++) {
      var hash = JSON.stringify(x[i]);
      if (parts[hash]) {
        delete parts[hash];
        remaining--;
        if (0 === remaining)
          return true;
      }
    }

    return false;
  },

  _in: function (x, qval) {
    if (typeof x !== "object") {
      // optimization: use scalar equality (fast)
      for (var i = 0; i < qval.length; i++)
        if (x === qval[i])
          return true;
      return false;
    } else {
      // nope, have to use deep equality
      for (var i = 0; i < qval.length; i++)
        if (Selector._f._equal(x, qval[i]))
          return true;
      return false;
    }
  },

  _type: function (v) {
    if (typeof v === "number")
      return 1;
    if (typeof v === "string")
      return 2;
    if (typeof v === "boolean")
      return 8;
    if (v instanceof Array)
      return 4;
    if (v === null)
      return 10;
    if (v instanceof RegExp)
      return 11;
    if (typeof v === "function")
      // note that typeof(/x/) === "function"
      return 13;
    return 3; // object

    // TODO support some/all of these:
    // 5, binary data
    // 7, object id
    // 9, date
    // 14, symbol
    // 15, javascript code with scope
    // 16, 18: 32-bit/64-bit integer
    // 17, timestamp
    // 255, minkey
    // 127, maxkey
  },

  // deep equality test: use for literal document and array matches
  _equal: function (x, qval) {
    var match = function (a, b) {
      // scalars
      if (typeof a === 'number' || typeof a === 'string' ||
          typeof a === 'boolean' || a === undefined || a === null)
        return a === b;
      if (typeof a === 'function')
        return false;

      // OK, typeof a === 'object'
      if (typeof b !== 'object')
        return false;

      // arrays
      if (a instanceof Array) {
        if (!(b instanceof Array))
          return false;
        if (a.length !== b.length)
          return false;
        for (var i = 0; i < a.length; i++)
          if (!match(a[i],b[i]))
            return false;
        return true;
      }

      // objects
/*
      var unmatched_b_keys = 0;
      for (var x in b)
        unmatched_b_keys++;
      for (var x in a) {
        if (!(x in b) || !match(a[x], b[x]))
          return false;
        unmatched_b_keys--;
      }
      return unmatched_b_keys === 0;
*/
      // Follow Mongo in considering key order to be part of
      // equality. Key enumeration order is actually not defined in
      // the ecmascript spec but in practice most implementations
      // preserve it. (The exception is Chrome, which preserves it
      // usually, but not for keys that parse as ints.)
      var b_keys = [];
      for (var x in b)
        b_keys.push(b[x]);
      var i = 0;
      for (var x in a) {
        if (i >= b_keys.length)
          return false;
        if (!match(a[x], b_keys[i]))
          return false;
        i++;
      }
      if (i !== b_keys.length)
        return false;
      return true;
    };
    return match(x, qval);
  },

  // if x is not an array, true iff f(x) is true. if x is an array,
  // true iff f(y) is true for any y in x.
  //
  // this is the way most mongo operators (like $gt, $mod, $type..)
  // treat their arguments.
  _matches: function (x, f) {
    if (x instanceof Array) {
      for (var i = 0; i < x.length; i++)
        if (f(x[i]))
          return true;
      return false;
    }
    return f(x);
  },

  // like _matches, but if x is an array, it's true not only if f(y)
  // is true for some y in x, but also if f(x) is true.
  //
  // this is the way mongo value comparisons usually work, like {x:
  // 4}, {x: [4]}, or {x: {$in: [1,2,3]}}.
  _matches_plus: function (x, f) {
    if (x instanceof Array) {
      for (var i = 0; i < x.length; i++)
        if (f(x[i]))
          return true;
      // fall through!
    }
    return f(x);
  },

  // maps a type code to a value that can be used to sort values of
  // different types
  _typeorder: function (t) {
    // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
    // TODO what is the correct sort position for Javascript code?
    // ('100' in the matrix below)
    // TODO minkey/maxkey
    return [-1, 1, 2, 3, 4, 5, -1, 6, 7, 8, 0, 9, -1, 100, 2, 100, 1,
            8, 1][t];
  },

  // compare two values of unknown type according to BSON ordering
  // semantics. (as an extension, consider 'undefined' to be less than
  // any other value.) return negative if a is less, positive if b is
  // less, or 0 if equal
  _cmp: function (a, b) {
    if (a === undefined)
      return b === undefined ? 0 : -1;
    if (b === undefined)
      return 1;
    var ta = Selector._f._type(a);
    var tb = Selector._f._type(b);
    var oa = Selector._f._typeorder(ta);
    var ob = Selector._f._typeorder(tb);
    if (oa !== ob)
      return oa < ob ? -1 : 1;
    if (ta !== tb)
      // TODO need to implement this once we implement Symbol or
      // integers, or once we implement both Date and Timestamp
      throw Error("Missing type coercion logic in _cmp");
    if (ta === 1) // double
      return a - b;
    if (tb === 2) // string
      return a < b ? -1 : (a === b ? 0 : 1);
    if (ta === 3) { // Object
      // this could be much more efficient in the expected case ...
      var to_array = function (obj) {
        var ret = [];
        for (var key in obj) {
          ret.push(key);
          ret.push(obj[key]);
        }
        return ret;
      }
      return Selector._f._cmp(to_array(a), to_array(b));
    }
    if (ta === 4) { // Array
      for (var i = 0; ; i++) {
        if (i === a.length)
          return (i === b.length) ? 0 : -1;
        if (i === b.length)
          return 1;
        var s = Selector._f._cmp(a[i], b[i]);
        if (s !== 0)
          return s;
      }
    }
    // 5: binary data
    // 7: object id
    if (ta === 8) { // boolean
      if (a) return b ? 0 : 1;
      return b ? -1 : 0;
    }
    // 9: date
    if (ta === 10) // null
      return 0;
    if (ta === 11) // regexp
      throw Error("Sorting not supported on regular expression"); // TODO
    // 13: javascript code
    // 14: symbol
    // 15: javascript code with scope
    // 16: 32-bit integer
    // 17: timestamp
    // 18: 64-bit integer
    // 255: minkey
    // 127: maxkey
    if (ta === 13) // javascript code
      throw Error("Sorting not supported on Javascript code"); // TODO
  }
};

// For unit tests. True if the given document matches the given
// selector.
Selector._matches = function (selector, doc) {
  return (Selector._compileSelector(selector))(doc);
};

// Given a selector, return a function that takes one argument, a
// document, and returns true if the document matches the selector,
// else false.
Selector._compileSelector = function (selector) {
  var literals = [];
  // you can pass a literal function instead of a selector
  if (selector instanceof Function)
    return function (doc) {return selector.call(doc);};

  // shorthand -- scalars match _id
  if ((typeof selector === "string") || (typeof selector === "number"))
    selector = {_id: selector};

  // protect against dangerous selectors.  falsey and {_id: falsey}
  // are both likely programmer error, and not what you want,
  // particularly for destructive operations.
  if (!selector || (('_id' in selector) && !selector._id))
    return function (doc) {return false;};

  // eval() does not return a value in IE8, nor does the spec say it
  // should. Assign to a local to get the value, instead.
  var _func;
  eval("_func = (function(f,literals){return function(doc){return " +
       Selector._exprForSelector(selector, literals) +
       ";};})");
  return _func(Selector._f, literals);
};

// TODO implement ordinal indexing: 'people.2.name'

// Given an arbitrary Mongo-style query selector, return an expression
// that evaluates to true if the document in 'doc' matches the
// selector, else false.
Selector._exprForSelector = function (selector, literals) {
  var clauses = [];
  for (var key in selector) {
    var value = selector[key];

    if (key.substr(0, 1) === '$') { // no indexing into strings on IE7
      // whole-document predicate like {$or: [{x: 12}, {y: 12}]}
      clauses.push(Selector._exprForDocumentPredicate(key, value, literals));
    } else {
      // else, it's a constraint on a particular key (or dotted keypath)
      clauses.push(Selector._exprForKeypathPredicate(key, value, literals));
    }
  };

  if (clauses.length === 0) return 'true'; // selector === {}
  return '(' + clauses.join('&&') +')';
};

// 'op' is a top-level, whole-document predicate from a mongo
// selector, like '$or' in {$or: [{x: 12}, {y: 12}]}. 'value' is its
// value in the selector. Return an expression that evaluates to true
// if 'doc' matches this predicate, else false.
Selector._exprForDocumentPredicate = function (op, value, literals) {
  if (op === '$or') {
    var clauses = [];
    utils.each(value, function (c) {
      clauses.push(Selector._exprForSelector(c, literals));
    });
    if (clauses.length === 0) return 'true';
    return '(' + clauses.join('||') +')';
  }

  if (op === '$and') {
    var clauses = [];
    utils.each(value, function (c) {
      clauses.push(Selector._exprForSelector(c, literals));
    });
    if (clauses.length === 0) return 'true';
    return '(' + clauses.join('&&') +')';
  }

  if (op === '$nor') {
    var clauses = [];
    utils.each(value, function (c) {
      clauses.push("!(" + Selector._exprForSelector(c, literals) + ")");
    });
    if (clauses.length === 0) return 'true';
    return '(' + clauses.join('&&') +')';
  }

  if (op === '$where') {
    if (value instanceof Function) {
      literals.push(value);
      return 'literals[' + (literals.length - 1) + '].call(doc)';
    }
    return "(function(){return " + value + ";}).call(doc)";
  }

  throw Error("Unrecogized key in selector: ", op);
}

// Given a single 'dotted.key.path: value' constraint from a Mongo
// query selector, return an expression that evaluates to true if the
// document in 'doc' matches the constraint, else false.
Selector._exprForKeypathPredicate = function (keypath, value, literals) {
  var keyparts = keypath.split('.');

  // get the inner predicate expression
  var predcode = '';
  if (value instanceof RegExp) {
    predcode = Selector._exprForOperatorTest(value, literals);
  } else if ( !(typeof value === 'object')
              || value === null
              || value instanceof Array) {
    // it's something like {x.y: 12} or {x.y: [12]}
    predcode = Selector._exprForValueTest(value, literals);
  } else {
    // is it a literal document or a bunch of $-expressions?
    var is_literal = true;
    for (var k in value) {
      if (k.substr(0, 1) === '$') { // no indexing into strings on IE7
        is_literal = false;
        break;
      }
    }

    if (is_literal) {
      // it's a literal document, like {x.y: {a: 12}}
      predcode = Selector._exprForValueTest(value, literals);
    } else {
      predcode = Selector._exprForOperatorTest(value, literals);
    }
  }

  // now, deal with the orthogonal concern of dotted.key.paths and the
  // (potentially multi-level) array searching they require.
  // while at it, make sure to not throw an exception if we hit undefined while
  // drilling down through the dotted parts
  var ret = '';
  var innermost = true;
  while (keyparts.length) {
    var part = keyparts.pop();
    var formal = keyparts.length ? "x" : "doc";
    if (innermost) {
      ret = '(function(x){return ' + predcode + ';})(' + formal + '&&' + formal + '[' +
        JSON.stringify(part) + '])';
      innermost = false;
    } else {
      // for all but the innermost level of a dotted expression,
      // if the runtime type is an array, search it
      ret = 'f._matches(' + formal + '&&' + formal + '[' + JSON.stringify(part) +
        '], function(x){return ' + ret + ';})';
    }
  }

  return ret;
};

// Given a value, return an expression that evaluates to true if the
// value in 'x' matches the value, or else false. This includes
// searching 'x' if it is an array. This doesn't include regular
// expressions (that's because mongo's $not operator works with
// regular expressions but not other kinds of scalar tests.)
Selector._exprForValueTest = function (value, literals) {
  var expr;

  if (value === null) {
    // null has special semantics
    // http://www.mongodb.org/display/DOCS/Querying+and+nulls
    expr = 'x===null||x===undefined';
  } else if (typeof value === 'string' ||
             typeof value === 'number' ||
             typeof value === 'boolean') {
    // literal scalar value
    // TODO object ids, dates, timestamps?
    expr = 'x===' + JSON.stringify(value);
  } else if (typeof value === 'function') {
    // note that typeof(/a/) === 'function' in javascript
    // TODO improve error
    throw Error("Bad value type in query");
  } else {
    // array or literal document
    expr = 'f._equal(x,' + JSON.stringify(value) + ')';
  }

  return 'f._matches_plus(x,function(x){return ' + expr + ';})';
};

// In a selector like {x: {$gt: 4, $lt: 8}}, we're calling the {$gt:
// 4, $lt: 8} part an "operator." Given an operator, return an
// expression that evaluates to true if the value in 'x' matches the
// operator, or else false. This includes searching 'x' if necessary
// if it's an array. In {x: /a/}, we consider /a/ to be an operator.
Selector._exprForOperatorTest = function (op, literals) {
  if (op instanceof RegExp) {
    return Selector._exprForOperatorTest({$regex: op}, literals);
  } else {
    var clauses = [];
    for (var type in op)
      clauses.push(Selector._exprForConstraint(type, op[type],
                                                      op, literals));
    if (clauses.length === 0)
      return 'true';
    return '(' + clauses.join('&&') + ')';
  }
};

// In an operator like {$gt: 4, $lt: 8}, we call each key/value pair,
// such as $gt: 4, a constraint. Given a constraint and its arguments,
// return an expression that evaluates to true if the value in 'x'
// matches the constraint, or else false. This includes searching 'x'
// if it's an array (and it's appropriate to the constraint.)
Selector._exprForConstraint = function (type, arg, others,
                                               literals) {
  var expr;
  var search = '_matches';
  var negate = false;

  if (type === '$gt') {
    expr = 'f._cmp(x,' + JSON.stringify(arg) + ')>0';
  } else if (type === '$lt') {
    expr = 'f._cmp(x,' + JSON.stringify(arg) + ')<0';
  } else if (type === '$gte') {
    expr = 'f._cmp(x,' + JSON.stringify(arg) + ')>=0';
  } else if (type === '$lte') {
    expr = 'f._cmp(x,' + JSON.stringify(arg) + ')<=0';
  } else if (type === '$all') {
    expr = 'f._all(x,' + JSON.stringify(arg) + ')';
    search = null;
  } else if (type === '$exists') {
    if (arg)
      expr = 'x!==undefined';
    else
      expr = 'x===undefined';
    search = null;
  } else if (type === '$mod') {
    expr = 'x%' + JSON.stringify(arg[0]) + '===' +
      JSON.stringify(arg[1]);
  } else if (type === '$ne') {
    if (typeof arg !== "object")
      expr = 'x===' + JSON.stringify(arg);
    else
      expr = 'f._equal(x,' + JSON.stringify(arg) + ')';
    search = '_matches_plus';
    negate = true; // tricky
  } else if (type === '$in') {
    expr = 'f._in(x,' + JSON.stringify(arg) + ')';
    search = '_matches_plus';
  } else if (type === '$nin') {
    expr = 'f._in(x,' + JSON.stringify(arg) + ')';
    search = '_matches_plus';
    negate = true;
  } else if (type === '$size') {
    expr = '(x instanceof Array)&&x.length===' + arg;
    search = null;
  } else if (type === '$type') {
    // $type: 1 is true for an array if any element in the array is of
    // type 1. but an array doesn't have type array unless it contains
    // an array..
    expr = 'f._type(x)===' + JSON.stringify(arg);
  } else if (type === '$regex') {
    // TODO mongo uses PCRE and supports some additional flags: 'x' and
    // 's'. javascript doesn't support them. so this is a divergence
    // between our behavior and mongo's behavior. ideally we would
    // implement x and s by transforming the regexp, but not today..
    if ('$options' in others && /[^gim]/.test(others['$options']))
      throw Error("Only the i, m, and g regexp options are supported");
    expr = 'literals[' + literals.length + '].test(x)';
    if (arg instanceof RegExp) {
      if ('$options' in others) {
        literals.push(new RegExp(arg.source, others['$options']));
      } else {
        literals.push(arg);
      }
    } else {
      literals.push(new RegExp(arg, others['$options']));
    }
  } else if (type === '$options') {
    expr = 'true';
    search = null;
  } else if (type === '$elemMatch') {
    // TODO implement
    throw Error("$elemMatch unimplemented");
  } else if (type === '$not') {
    // mongo doesn't support $regex inside a $not for some reason. we
    // do, because there's no reason not to that I can see.. but maybe
    // we should follow mongo's behavior?
    expr = '!' + Selector._exprForOperatorTest(arg, literals);
    search = null;
  } else {
    throw Error("Unrecognized key in selector: " + type);
  }

  if (search) {
    expr = 'f.' + search + '(x,function(x){return ' +
      expr + ';})';
  }

  if (negate)
    expr = '!' + expr;

  return expr;
};
// Give a sort spec, which can be in any of these forms:
//   {"key1": 1, "key2": -1}
//   [["key1", "asc"], ["key2", "desc"]]
//   ["key1", ["key2", "desc"]]
//
// (.. with the first form being dependent on the key enumeration
// behavior of your javascript VM, which usually does what you mean in
// this case if the key names don't look like integers ..)
//
// return a function that takes two objects, and returns -1 if the
// first object comes first in order, 1 if the second object comes
// first, or 0 if neither object comes before the other.

// XXX sort does not yet support subkeys ('a.b') .. fix that!

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
};var Utils = {};

Utils._deepcopy = function (v) {
  if (typeof v !== "object")
    return v;
  if (v === null)
    return null; // null has typeof "object"
  if (utils.isArray(v)) {
    var ret = v.slice(0);
    for (var i = 0; i < v.length; i++)
      ret[i] = Utils._deepcopy(ret[i]);
    return ret;
  }
  var ret = {};
  for (var key in v)
    ret[key] = Utils._deepcopy(v[key]);
  return ret;
};

Utils.each = Utils.forEach = function(obj, iterator, context) {
    if (obj === null) return;
    var nativeForEach = Array.prototype.forEach;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

Utils.isArray = Array.isArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

Utils.debug = function(data){ };

var utils = Utils;
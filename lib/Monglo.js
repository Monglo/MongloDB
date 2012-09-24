/*!
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

Monglo.version = '0.1.3';

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
      fn[command](args,cb);
    } else if('function' === typeof fn.all){
      args.name = name;
      fn.all(args,cb);
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
}
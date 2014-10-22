![MongoDB](https://github.com/Monglo/monglo.github.com/raw/master/images/logo.png)

Portable Pure JS MongoDB With Extra Awesomeness

Version 0.3.0

## REFACTOR IN PROGRESS !!!

##Breaking API Changes*
 - Collection methods
   - Return result via callback see below docs for examples

## Status: (Stable)
 - See TODO
 - Pull requests are always welcome

## Features
 - MongoDB style queries
 - Persistence for Collections
 - Data Persistence Plug-in system

## TODO
  - Finish Docs
  - Add more datastores
  - Add remaining functions
  - Code/function Clean up and optimization


## Building
```
 $ npm install
 $ make
```

### initilize

```js
var Monglo = require('monglo');
var db = Monglo('DBNAME');
```

## DataStore
Datastores for persistence your db with local/remote data
```
var monglo = require('./index').Monglo;
var db = monglo('DemoDB');

//Define a store locally or import a common js module;
//See source for all available functions
function DemoStore(){
  return {
    insert : function(args){  },
    update : function(args){  },
    open   : function(args){  },
    remove : function(args){  },
       all : function(args){  }
  };
}
//Load the store in Monglo
db.use('store', new DemoStore());
```

### find
Find all docs that match query parameters
```js
db.someCollection.find({}, function ( error, cursor ){ });
```

### findOne
Find a single doc that matches query parameters

```js
db.someCollection.findOne({}, function ( error, doc ){ });
```

### insert
Insert a new doc

```js
db.someCollection.insert({text: "Hello, world!"}, function ( error, doc ){ });
```

### update
Update and existing doc

```js
db.someCollection.update({name:'tester'}, {$set: {text: 'test'}}, function ( err, doc ){ });
```

### save
Update doc if exists if not insert the new doc

```js
db.someCollection.save({DOC}, function ( err, doc ){ });
```

### remove
Remove the doc matching the query selector

```js
db.someCollection.remove({uid:'34245'}, function (err) { });
```

### backup
Saves snapshot of collection's current state in memory
Backup ID defaults to a new ObjectId string if non is provided

```js
db.someCollection.backup('backuId_1234', function (err) { });
```

### restore
Restore the state of a collection from backup

```js
db.someCollection.restore('backuId_1234', function (err) { });
```

### backups
Lists available Backups

```js
db.someCollection.backups(function (err) { });
```

### removeBackup
Remove a backup from memory.
If backup id is left empty all backups will be removed;

```js
db.someCollection.removeBackup('backuId_1234', function (err) { });
```

## Cursors

To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.

```js
db.someCollection.find({}, function (err, cursor) {
  // Cursor instance for query
});
```

### forEach
Call the callback function once for each matching document.

```js
someCursor.forEach(function(doc){ console.log(doc); });
```

### map
Map callback over all matching documents. Returns an Array.

```js
someCursor.map(function(doc){
  doc.fullname = doc.firstname+' '+doc.lastname;
  return doc;
});
```

### fetch
Return all matching documents as an Array.

```js
someCursor.fetch(function(docs){ console.log(docs); });
```

### count
Returns the number of documents that match a query.

```js
someCursor.count();
```

### rewind
Resets the query cursor.

```js
someCursor.rewind();
```

### Events
Watch a query. Receive callbacks as the result set changes.

```js
Monglo.Collection('my_collection');
var someCollection = db.someCollection('mycollection');

//See docs for all events
someCollection.on('insert', function(){ /** Do something  **/ });
someCollection.on('update', function(){ /** Do something  **/ });
someCollection.on('remove', function(){ /** Do something  **/ });
someCollection.on('find', function(){ /** Do something  **/ });
someCollection.on('createCollection', function(){ /** Do something  **/ });
someCollection.on('removeCollection', function(){ /** Do something  **/ });
```

## License

(The MIT License)

Copyright (c) 2013 Christian Sullivan &lt;cs@euforic.co&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

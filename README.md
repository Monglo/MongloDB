![MongoDB](https://github.com/Monglo/monglo.github.com/raw/master/images/logo.png)

Portable Pure JS MongoDB With Extra Awesomeness

## Status: (Stable)
 - See TODO
 - Pull requests are always welcome

## Features
 - MongoDB style queries
 - Persistence for Collections
 - Data Persistence Plugin system

## TODO
  - Finish Docs
  - Add more datastores
  - Add remaining functions
  - Code/function Clean up and optimization


## Building

```
$ git clone https://github.com/euforic/monglodb.git
$ cd monglodb
$ npm install -d
$ make clean && make
```
Builds will be located in __dist__ folder



### initilize

```js
var Monglo = require('monglo').Monglo;
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
    insert : function(db,args){  },
    update : function(db,args){  },
    open   : function(db,args){  },
    remove : function(db,args){  },
       all : function(db,args){  }
  };
}
//Load the store in Monglo
db.use('store', new DemoStore());
```

### find

```js
db.someCollection.find();
```

### insert

```js
db.someCollection.insert({text: "Hello, world!"});
```

### update

```js
db.someCollection.update(my_record[0].id, {$set: {text: 'test'}});
```

### remove
```js
db.someCollection.remove(selector, callback);
```

## Cursors

To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.

```js
var someCursor = db.someCollection.find();
```

### forEach
Call the callback function once for each matching document.

```js
someCursor.forEach(callback);
```

### map
Map callback over all matching documents. Returns an Array.

```js
someCursor.map(callback);
```

### fetch
Return all matching documents as an Array.

```js
someCursor.fetch(callback);
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

Copyright (c) 2012 Christian Sullivan &lt;cs@euforic.co&gt;

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
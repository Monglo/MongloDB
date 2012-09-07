# ![MongoDB](https://github.com/euforic/monglodb/raw/gh-pages/images/logo.png)

Pure JS implementation of MongoDB

## Status: (Stable)
 - See TODO
 - Pull requests are always welcome

## Features
 - MongoDB style queries
 - Persistence for Collections

## TODO
  - Finish Docs
  - Alternative Data store plug-in system.
  - Remote Data syncing
  - Add remaining functions
  - Add unified database to load all collections on open
  - Code/function Clean up and optimization

## Building

Builds will be located in __dist__ folder

```js
	$ git clone https://github.com/euforic/monglodb.git
	$ cd monglodb
	$ make clean
	$ make
```

## API

### Database

#### Monglo.Collection([String]);

Opens collection from disk if exists. If no file found new collection created

```js
	Monglo.Collection('my_collection');
```

#### Monglo.createCollection([String])

Creates new collection

```js
	Monglo.createCollection('my_collection');
```

#### Monglo.openCollection([String])

Opens saved collection file and loads in to memory

```js
	Monglo.openCollection('my_collection');
```

#### Monglo.saveCollection([String])

Saves collection at current state to file

```js
	Monglo.saveCollection('my_collection');
```

#### Monglo.removeCollection([String])

Removes collection from memory and deletes collection file

```js
	Monglo.removeCollection('my_collection');
```

#### Monglo.clearCollection([String])

Empties collections docs from memory

```js
	Monglo.clearCollection('my_collection');
```

### Collection

#### open

Description of function

```js
	//Code Example
```

#### drop

Description of function

```js
	//Code Example
```

#### insert

Description of function

```js
	//Code Example
```

#### remove

Description of function

```js
	//Code Example
```

#### update

Description of function

```js
	//Code Example
```

#### commit

Description of function

```js
	//Code Example
```

#### find

Description of function

```js
	//Code Example
```

#### findOne

Description of function

```js
	//Code Example
```

#### ObjectId

Description of function

```js
	//Code Example
```

#### snapshot

Description of function

```js
	//Code Example
```

#### restore

Description of function

```js
	//Code Example
```

#### pauseObservers

Description of function

```js
	//Code Example
```

#### resumeObservers

Description of function

```js
	//Code Example
```

## Cursor

#### rewind

Description of function

```js
	//Code Example
```

#### forEach

Description of function

```js
	//Code Example
```

#### map

Description of function

```js
	//Code Example
```

#### fetch

Description of function

```js
	//Code Example
```

#### count

Description of function

```js
	//Code Example
```

#### observe

Description of function

```js
	//Code Example
```

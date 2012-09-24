/*!
 * Monglo - cursor
 * Copyright (c) 2012 Christian Sullivan <cs@euforic.co>
 * MIT Licensed
 */

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
};
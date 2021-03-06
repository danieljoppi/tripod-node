var config = require("./config");
var MongoClient = require("mongodb").MongoClient;
var TripleGraph = require('./graph');
var _ = require("lodash");
var _connections = {}; // see https://groups.google.com/forum/#!msg/node-mongodb-native/mSGnnuG8C1o/Hiaqvdu1bWoJ

/**
 * Main tripod object
 * @constructor
 */
var Tripod = function(dbName,collectionName) {
    this._config = config;
    if (config.get("databases:"+dbName+":connStr")) {
        this._connStr = config.get("databases:"+dbName+":connStr")+"/"+dbName;
    } else {
        this._connStr = config.get("databases:defaultConnStr")+"/"+dbName;
    }
    this._collectionName = collectionName;
    this._collection = null;
    this._viewsCollection = null;
};

/**
 * Describe resource r in named context c
 * @param r
 * @param c if null will default to config.defaultContext
 * @param callback
 */
Tripod.prototype.describe = function(r,c,callback) {
    c = (c==null) ? this._config.get("defaultContext") : c;
    // todo: alias c and r
    this.graph({_id:{"r":r,"c":c}},callback);
};

/**
 * Describe resources represented in the Array ids
 * @param ids Array containing id objects {r:.. c:..}
 * @param callback
 */
Tripod.prototype.multiDescribe = function(ids,callback) {
    this.graph({_id: {'$in':ids}},callback);
};

/**
 * Get a graph containing view of type v for resource
 * @param v - view type
 * @param r - resource
 * @param c - context, if null default context used
 * @param callback
 */
Tripod.prototype.getViewForResource = function (v,r,c,callback) {
    c = (c==null) ? this._config.get("defaultContext") : c;
    this._getViewsCollection(function(err,collection) {
        if (err) {
            callback(err,null);
        } else {
            collection.findOne({_id:{"r":r,"c":c,type:v}},function(err,doc) {
                if (err) {
                    callback(err,null);
                } else {
                    var graph = new TripleGraph();
                    graph.addTripodDoc(doc);
                    callback(null,graph);
                }
            });
        }
    });
};

/**
 * Fetch a graph based on a query
 * @param query
 * @param callback
 */
Tripod.prototype.graph = function(query,callback) {
    this._getCollection(function(err,collection) {
        if (err) {
            callback(err,null);
        } else {
            collection.find(query).toArray(function(err,docs) {
                if (err) {
                    callback(err,null);
                } else {
                    var graph = new TripleGraph();
                    docs.forEach(function(doc) {
                        graph.addTripodDoc(doc);
                    });
                    callback(null,graph);
                }
            });
        }
    })
};

/**
 * Get a graph containing the views of type v for the resources represented in the Array ids
 * @param v - view type
 * @param ids Array containing id objects {r:.. c:..}
 * @param callback
 */
Tripod.prototype.getViewForResources = function (v,ids,callback) {
    var idsWithType = [];
    ids.forEach(function(id) {
        var idWithType = _.clone(id);
        idsWithType['type'] = v;
        idsWithType.push(idWithType);
    });
    var query = {_id: {'$in':idsWithType}};
    this._getViewsCollection(function(err,collection) {
        if (err) {
            callback(err,null);
        } else {
            collection.find(query).toArray(function(err,docs) {
                if (err) {
                    callback(err,null);
                } else {
                    var graph = new TripleGraph();
                    docs.forEach(function(doc) {
                        graph.addTripodDoc(doc);
                    });
                    callback(null,graph);
                }
            });
        }
    });
};

/**
 * Lazy-load collection
 * @param callback
 * @private
 */
Tripod.prototype._getCollection = function(callback) {
    if (this._collection == null) {
        var self = this;
        self._getDb(function(err,db) {
            if (err) {
                callback(err,null);
            } else {
                db.collection(self._collectionName, function(err,collection) { // todo: check if collection is in config...?
                    if (err) {
                        callback(err,null);
                    } else {
                        self._collection = collection;
                        callback(null,collection)
                    }
                });
            }
        });
    } else {
        callback(null,this._collection);
    }
};

/**
 * Lazy-load views collection
 * @param callback
 * @private
 */
Tripod.prototype._getViewsCollection = function(callback) {
    if (this._viewsCollection == null) {
        var self = this;
        self._getDb(function(err,db) {
            if (err) {
                callback(err,null);
            } else {
                db.collection("views", function(err,collection) {
                    if (err) {
                        callback(err,null);
                    } else {
                        self._viewsCollection = collection;
                        callback(null,collection)
                    }
                });
            }
        });
    } else {
        callback(null,this._viewsCollection);
    }
};

/**
 * Gets a DB from global, if there isn't one instantiates
 * @see https://groups.google.com/forum/#!msg/node-mongodb-native/mSGnnuG8C1o/Hiaqvdu1bWoJ
 * @param callback
 * @private
 */
Tripod.prototype._getDb = function(callback) {
    var self = this;
    if (_.has(_connections,self._connStr)) {
        callback(null,_connections[self._connStr]);
    } else {
        MongoClient.connect(self._connStr,function(err,db){
            if (err) {
                callback(err,null);
            } else {
                _connections[self._connStr] = db;
                callback(null,db);
            }
        });
    }
};

exports = module.exports = Tripod;

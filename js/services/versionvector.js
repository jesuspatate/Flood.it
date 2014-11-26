(function() {
  angular.module('floodit').factory('VersionVector', function() {

  /**
   * \class VersionVector
   * \brief A vector clock that characterizes causality between operations
   * \param e the entry of the local site (1 entry <-> 1 site)
   */
  var VersionVector = function(e) {
    this._entries = [e];
    this._clocks = [0];
  };

  /**
   * \brief Increments the local entry
   */
  VersionVector.prototype.increment = function() {
      this._clocks[0] += 1;
  };

  /**
   * \brief Increments from a remote version vector assumed ready
   * \param vv a version vector
   */
  VersionVector.prototype.incrementFrom = function (vv) {
      var idxEntry = 1;
      var found = false;

      while (!found && idxEntry < this._entries.length) {
        if (this._entries[idxEntry] === vv._entries[0]) {
          found = true;
        }
        else {
          ++idxEntry;
        }
      }

      if(!found) {
        this._entries.push(vv._entries[0]);
      }

      this._clocks[idxEntry] = vv._clocks[0];
  };

  /**
   * \brief Checks if the given version vector is causally ready
   * \param vv the version vector to check
   */
  VersionVector.prototype.isReady = function(vv) {
    var ready = true;

    // #1 vv._clocks[vv._entries[0]] = this._clocks[vv._entries[0]] + 1
    {
      var found = false;
      var idx = 1;

      while (!found && idx < this._entries.length) {
        if (this._entries[idx] === vv._entries[0]) {
          found = true;
        }
        else {
          ++idx;
        }
      }

      if(found) {
        ready = (this._clocks[idx] === vv._clocks[0] - 1);
      }
      else {
        ready = (vv._clocks[0] === 1);
      }
    }

    // #2 vv._clocks[i] <= this._clocks[i]
    {
      var id, idx, found;

      for (var i = 1 ; i < vv._entries.length && ready ; ++i) {
        id = vv._entries[i];

        found = false;
        idx = 0;

        while (!found && idx < this._entries.length) {
          if (this._entries[idx] === id) {
            found = true;
          }
          else {
            ++idx;
          }
        }

        if (found) {
          ready = (vv._clocks[i] <= this._clocks[idx]);
        }
        else {
          ready = (vv._clocks[i] === 0);
        }
      }
    }

    return ready;
  };

  /**
   * \brief Checks if the given version vector is strictly lower than
   * this one.
   *
   * \param vv the version vector to check
   */
  VersionVector.prototype.isLower = function(vv) {
    // ((vv._entries[0] in this._entries) && (vv._clocks[0] <= this._clocks[vv._entries[0]]));

    var found = false;
    var idx = 1;

    while (!found && idx < this._entries.length) {
      if (this._entries[idx] === vv._entries[0]) {
        found = true;
      }
      else {
        ++idx;
      }
    }

    return (found && vv._clocks[0] <= this._clocks[idx]);
  };

  VersionVector.prototype.clone = function() {
    var c;

    if (this._entries[0].clone != undefined) {
      c = new VV(this._entries[0].clone());
    } else {
      c = new VV(this._entries[0]);
    }

    c.incrementFrom(this);

    return c;
  };

  VersionVector.prototype.toString = function() {
    return '{entries: ' + this._entries + ', clocks: ' + JSON.stringify(this._clocks) + '}';
  };

  VersionVector.prototype.toJSON = function() {
    return {_entries: this._entries, _clocks: this._clocks};
  };

    return VersionVector;
  });
})();


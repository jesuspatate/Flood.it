(function() {
  angular.module('floodit').service('messageHandler', [
    '$log', 'VersionVector', 'connections', 'sharedData',
    function($log, VersionVector, connections, sharedData) {

    var msgTypesEnum = {
      JREQ: 0,
      JRES: 1,
      DATA: 2,
      DISC: 3,
      READY: 4,
      ACK_READY: 5
    };

    var versionVector;
    var buffer = [];
    var forward = [];

    var callbacks = {};

    this.init = function(id) {
      versionVector = new VersionVector(id);
    };

    this.handle = function(message, sender) {
      var obj = JSON.parse(message);
      var data = obj.data;

      $log.info('Received from ' + sender + ': ' + JSON.stringify(obj));

      switch(data.key) {
        case msgTypesEnum.JREQ:
          $log.info(sender + ' (' + data.param.alias + ') requested to join the document');
          handleJoinRequest(sender);
          break;

        case msgTypesEnum.JRES:
          handleJoinResponse(data.param, sender);
          break;

        case msgTypesEnum.READY:
          handleReady(data.param, sender, true);
          break;

        case msgTypesEnum.ACK_READY:
          handleReady(data.param, sender, false);
          break;

        case msgTypesEnum.DATA:
          var vv = data.vv;

          forwardMessage(message);

          if (!versionVector.isLower(vv)) { // Not already delivered
            if (versionVector.isReady(vv)) {
              versionVector.incrementFrom(vv);
              handleData(data.param);
              checkBuffer();
            }
            else { // Not causaly ready
              buffer.push(data);
            }
          }

          break;

        default:
      }
    };

    this.sendJoin = function(recipient) {
      sendMessage(recipient, msgTypesEnum.JREQ, {alias: sharedData.getAlias()});
    };

    this.sendReady = function() {
      var neighbours = connections.getNeighbours();

      for (var idx in neighbours) {
        sendMessage(neighbours[idx], msgTypesEnum.READY, {alias: sharedData.getAlias()});
      }
    };

    this.sendInsertion = function(couples) {
      versionVector.increment();

      var neighbours = connections.getNeighbours();

      for (idx in neighbours) {
        sendMessage(neighbours[idx], msgTypesEnum.DATA, {type: 'insertion', data: couples});
      }
    };

    this.sendDeletion = function(ids) {
      versionVector.increment();

      var neighbours = connections.getNeighbours();

      for (idx in neighbours) {
        sendMessage(neighbours[idx], msgTypesEnum.DATA, {type: 'deletion', data: ids});
      }
    };

    this.addListener = function(event, callback, obj) {
      if (!callbacks[event]) {
        callbacks[event] = [];
      }

      callbacks[event].push({obj: obj, callback: callback});
    };

    function handleJoinRequest(requester) {
      forward.push(requester);

      var param = {
        title: sharedData.getDocumentTitle(),
        alias: sharedData.getAlias(),
        doc: sharedData.getDocumentModel(),
        vv: versionVector,
        participants: []
      };

      var neighbours = connections.getNeighbours();

      for (var idx in neighbours) {
        if (neighbours[idx] != requester) {
          param.participants.push(neighbours[idx]);
        }
      }

      sendMessage(requester, msgTypesEnum.JRES, param);
    }

    function handleJoinResponse(data, sender) {
      versionVector.union(data.vv);
      notify('remoteInsertion', data.doc);
      notify('buildConnections', data.participants);

      sharedData.setDocumentTitle(data.title);
      sharedData.addParticipant(sender, data.alias);
    }

    function handleReady(data, sender, ack) {
      removeForward(sender);

      sharedData.addParticipant(sender, data.alias);
      connections.setReady(sender);

      if (ack) {
        sendMessage(sender, msgTypesEnum.ACK_READY, {alias: sharedData.getAlias()});
      }
    }

    function handleData(data) {
      if (data.type === 'insertion') {
        notify('remoteInsertion', data.data);
      }
      else {
        if (data.type === 'deletion') {
          notify('remoteDeletion', data.data);
        }
        else {
          throw("Malformed data");
        }
      }
    }

    function sendMessage(recipient, key, param) {
      var msg = {
        error: null,
        data: {
          vv: versionVector,
          key: key,
          param: param
        }
      };

      var connection = connections.get(recipient);

      if(connection) {
        connection.send(JSON.stringify(msg));
      }

      $log.info("Sent to " + recipient + ": " + JSON.stringify(msg));
    }

    function sendErrorMessage(recipient, key, desc) {
      var msg = {
        error: {
          key: key,
          description: desc
        },
        data: null
      };

      var connection = connections.get(recipient);

      if(connection) {
        connection.send(JSON.stringify(msg));
      }

      $log.info("Sent to " + recipient + ": " + JSON.stringify(msg));
    }

    function forwardMessage(msg) {
      for (var idx = 0 ; idx < forward.length ; ++idx) {
        var connection = connections.get(forward[idx]);

        if(connection) {
          connection.send(msg);
        }
        else {
          forward.splice(idx, 1);
        }
      }
    }

    function removeForward(id) {
      var idx = 0;
      var found = false;

      while (!found && idx < forward.length) {
        if(forward[idx] === id) {
          found = true;
          forward.splice(idx, 1);
        }

        ++idx;
      }
    }

    function checkBuffer() {
      var idx = 0;

      while(idx < buffer.length) {
        var op = buffer[idx];

        if (versionVector.isLower(vv)) {
          buffer.splice(idx, 1);
        }
        else {
          if (versionVector.isReady(op.vv)) {
            handleData(op.param);
            buffer.splice(idx, 1);
            idx = 0;
          }
          else {
            ++idx;
          }
        }
      }
    }

    function notify(event) {
      var argumentsArray = Array.prototype.slice.apply(arguments);
      argumentsArray.splice(0,1);

      if (callbacks[event]) {
        var entry;

        for (var idx in callbacks[event]) {
          entry = callbacks[event][idx];
          entry.callback.apply(entry.obj, argumentsArray);
        }
      }
    }

  }]);
})();

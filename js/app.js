"use strict";

(function() {
  var app = angular.module('floodit', ['ui.bootstrap','ui.ace']);

  app.run(function(server, editorService) {
    editorService.addListener('insertion', server.insert, server);
    editorService.addListener('deletion', server.remove, server);
    server.addListener('remoteInsertion', editorService.applyInsertion, editorService);
    server.addListener('remoteDeletion', editorService.applyDeletion, editorService);
  });

  // Server controller

  app.controller('ServerCtrl', [
    '$scope', '$modal', '$log', 'server', 'doc', 'alerts',
    function($scope, $modal, $log, server, doc, alerts) {

    var scope = $scope;
    var mainScope = scope.$parent;

    scope.button = {
      active: false,
      text: 'Connect',
      activeText: 'Connecting...'
    };

    var userInputs = {};

    scope.register = function(inputs) {
      userInputs = inputs;

      var registerPromise = server.register(inputs.address, inputs.port);
      registerPromise.then(registerSuccess, registerFailure);
    };

    scope.modalDismissed = function() {
      // Modal closed while the form was not submitted
      $log.error('Connection modal dismissed at: ' + new Date());
      scope.button.active = false;
    };

    function registerSuccess(id) {
      doc.setTitle(userInputs.title);
      doc.setAlias(userInputs.alias);

      if (userInputs.action === 'join') {
        join();
      } else {
        connected();
      }
    }

    function registerFailure(err) {
      scope.button.active = false;
    }

    function join() {
      var joinPromise = server.join(userInputs.remoteID);
      joinPromise.then(connected, joinFailure);
    }

    function connected() {
      alerts.showSuccess('You successfully connected.');
      mainScope.connected = true;
    }

    function joinFailure() {
      scope.button.active = false;
    }
  }]);

  app.directive('fiToggle', function() {
    return {
      scope: {
        active: '=fiToggle',
        activeText: '='
      },
      link: function($scope, element, attrs) {
        var oldValue;

        $scope.$watch("active", function(value) {
          if (value) {
            oldValue = element.text();
            element.text($scope.activeText);
          } else {
            element.text(oldValue);
          }

          element.attr("disabled", value);
        });

        element.bind('click', function() {
          $scope.$apply(function() {
            $scope.active = !$scope.active;
          });
        });
      }
    };
  });

  // Client controller

  app.controller('ClientCtrl', [
    '$scope', '$timeout', 'doc', 'editorService',
    function($scope, $timeout, doc, editorService) {

    $scope.doc = {};

    doc.addListener(function() {
      $scope.doc.title = doc.getTitle();
      $scope.doc.alias = doc.getAlias();
      $scope.doc.participants = doc.getParticipants();

      // XXX $applyAsinc not available within this version of angular (<1.3.0) :(
      $timeout(function() {
        $scope.$apply();
      }, 100);
    });

    $scope.aceLoaded = function(_editor) {
      editorService.init(_editor);
      _editor.setBehavioursEnabled(false);
      _editor.setShowPrintMargin(false);
      _editor.getSession().setUseWrapMode(true);
      _editor.getSession().setUseSoftTabs(false);
    };

    $scope.aceChanged = function(event) {
      editorService.handle(event);
    };
  }]);
})();
'use strict';

require('mocha-helpers')(module);

function setUpSinon() {
  // eslint-disable-next-line prefer-let/prefer-let
  const sinon = require('sinon');

  global.before(function() {
    this.sinon = sinon;
  });

  global.afterEach(function() {
    sinon.restore();
  });
}

Object.assign(module.exports, {
  setUpSinon
});

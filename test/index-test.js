'use strict';

const { describe } = require('./helpers/mocha');
const { expect } = require('./helpers/chai');
const { getStatus } = require('..');

describe(function() {
  it('works', async function() {
    let status = await getStatus({
      commit: '0b1e36a16c1319424f686facc84c7ca386d34842',
      context: 'continuous-integration/travis-ci/push'
    });

    expect(status.state).to.equal('success');
    expect(status.description).to.equal('The Travis CI build passed');
  });
});

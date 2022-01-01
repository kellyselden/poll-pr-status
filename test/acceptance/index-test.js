'use strict';

const { describe } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const { getStatus } = require('../..');

describe(function() {
  it('works', async function() {
    let status = await getStatus({
      commit: 'e59fc1fb8eb456a7d4c4d29f84ceb135d9711570',
      context: 'continuous-integration/travis-ci/push'
    });

    expect(status.state).to.equal('success');
    expect(status.description).to.equal('The Travis CI build passed');
  });
});

'use strict';

const { describe } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const { getStatus } = require('../..');

describe(function() {
  it('Travis CI', async function() {
    let status = await getStatus({
      commit: '0b1e36a16c1319424f686facc84c7ca386d34842',
      context: 'Travis CI - Branch'
    });

    expect(status.conclusion).to.equal('success');
    expect(status.output.title).to.equal('Build Passed');
  });

  it('GitHub Actions', async function() {
    let status = await getStatus({
      commit: '340033cc59a83ed5c000669a8e39a50dcd4356d1',
      context: 'lint'
    });

    expect(status.conclusion).to.equal('success');
    expect(status.id).to.equal(4637956596);
  });
});

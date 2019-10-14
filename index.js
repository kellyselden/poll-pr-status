'use strict';

const { promisify } = require('util');
const request = promisify(require('request'));
const { URL } = require('url');
const pkgUp = require('pkg-up');
const ci = require('ci-info');

async function getStatus({
  commit,
  repository,
  context,
  interval = 1000
}) {
  return await new Promise(resolve => {
    (async function getStatus() {
      if (!commit) {
        // https://github.com/watson/ci-info/pull/42
        if (ci.TRAVIS) {
          if (ci.isPR) {
            commit = process.env.TRAVIS_PULL_REQUEST_SHA;
          } else {
            commit = process.env.TRAVIS_COMMIT;
          }
        } else if (process.env.GITHUB_ACTIONS) {
          commit = process.env.GITHUB_SHA;
        }
      }

      if (!repository) {
        repository = require(await pkgUp()).repository;
      }

      let url = new URL(repository);

      let status;

      switch (url.host) {
        case 'github.com': {
          let [, org, name] = url.pathname.match(/^\/(.+)\/(.+)\.git$/);

          let repo = `${org}/${name}`;

          let { body } = await request({
            url: `https://api.github.com/repos/${repo}/statuses/${commit}`,
            headers: {
              'User-Agent': repo
            },
            json: true
          });

          status = body.find(status => status.context === context);

          if (status && status.state !== 'pending') {
            return resolve(status);
          }

          break;
        }
      }

      if (!status && !ci.isPR) {
        return resolve(null);
      }

      setTimeout(getStatus, interval);
    })();
  });
}

module.exports = {
  getStatus
};

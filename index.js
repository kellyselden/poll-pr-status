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
  return await new Promise((resolve, reject) => {
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

          let response = await request({
            url: `https://api.github.com/repos/${repo}/statuses/${commit}`,
            headers: {
              'User-Agent': repo
            },
            json: true
          });

          if (response.statusCode === 403) {
            return reject(new Error(response.body.message));
          }

          status = response.body.find(status => status.context === context);

          if (status && status.state !== 'pending') {
            return resolve(status);
          }

          break;
        }
      }

      // https://github.com/watson/ci-info/pull/42
      if (!status && !(ci.isPR || process.env.GITHUB_EVENT_NAME === 'pull_request')) {
        return resolve(null);
      }

      setTimeout(getStatus, interval);
    })();
  });
}

module.exports = {
  getStatus
};

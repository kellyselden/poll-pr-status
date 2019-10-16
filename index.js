'use strict';

const { promisify } = require('util');
const request = promisify(require('request'));
const { URL } = require('url');
const pkgUp = require('pkg-up');
const ci = require('ci-info');
const execa = require('execa');

async function getStatus({
  commit,
  repository,
  context,
  token,
  interval = 1000
}) {
  return await new Promise((resolve, reject) => {
    (async function getStatus(options = {}) {
      if (!commit) {
        // https://github.com/watson/ci-info/pull/42
        if (ci.TRAVIS) {
          if (ci.isPR) {
            commit = process.env.TRAVIS_PULL_REQUEST_SHA;
          } else {
            commit = process.env.TRAVIS_COMMIT;
          }
        } else if (process.env.GITHUB_ACTIONS) {
          // commit = process.env.GITHUB_SHA;
          commit = (await execa.command('git rev-parse HEAD^2')).stdout;
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
              'User-Agent': repo,
              ...token ? {
                'Authorization': `token ${token}`
              } : {},
              ...options.etag ? {
                'If-None-Match': options.etag
              } : {}
            },
            json: true
          });

          if (response.statusCode === 403) {
            return reject(new Error(response.body.message));
          }

          if (response.statusCode === 304) {
            break;
          }

          status = response.body.find(status => status.context === context);

          if (status && status.state !== 'pending') {
            return resolve(status);
          }

          options.etag = response.headers.etag;

          break;
        }
      }

      // https://github.com/watson/ci-info/pull/42
      if (!status && !(ci.isPR || process.env.GITHUB_EVENT_NAME === 'pull_request')) {
        return resolve(null);
      }

      setTimeout(getStatus, interval, options);
    })();
  });
}

module.exports = {
  getStatus
};

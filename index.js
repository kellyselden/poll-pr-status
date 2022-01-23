'use strict';

const { promisify } = require('util');
const { URL } = require('url');
const ci = require('ci-info');
const { name } = require('./package');

function getTime() {
  return new Date().getTime();
}

async function getStatus({
  cwd = process.cwd(),
  request = promisify(require('request')),
  setTimeout = global.setTimeout,
  commit,
  repository,
  context,
  token,
  interval = 1e3,
  timeout = 30e3
}) {
  if (!commit) {
    // https://github.com/watson/ci-info/pull/42
    if (ci.TRAVIS) {
      if (ci.isPR) {
        commit = process.env.TRAVIS_PULL_REQUEST_SHA;
      } else {
        commit = process.env.TRAVIS_COMMIT;
      }
    } else if (process.env.GITHUB_ACTIONS) {
      // eslint-disable-next-line prefer-let/prefer-let
      const { execa } = await import('execa');

      // commit = process.env.GITHUB_SHA;
      commit = (await execa('git', ['rev-parse', 'HEAD^2'], { cwd })).stdout;
    } else {
      throw new Error('CI server not recognized');
    }
  }

  if (!repository) {
    // eslint-disable-next-line prefer-let/prefer-let
    const { pkgUp } = await import('pkg-up');

    repository = require(await pkgUp({ cwd })).repository;

    if (typeof repository !== 'string') {
      repository = repository.url;
    }
  }

  let url = new URL(repository);

  let start = getTime();
  let end = start + timeout;

  return await new Promise((resolve, reject) => {
    async function getStatus() {
      try {
        let result = await _getStatus(...arguments);

        if (result !== undefined) {
          resolve(result);
        }
      } catch (err) {
        reject(err);
      }
    }

    async function _getStatus(options = {}) {
      let now = getTime();

      if (now >= end) {
        throw new Error(`${name} has timed out`);
      }

      let result;

      switch (url.host) {
        case 'github.com': {
          let [, org, name] = url.pathname.match(/^\/(.+)\/(.+)\.git$/);

          let repo = `${org}/${name}`;

          let response = await request({
            url: `https://api.github.com/repos/${repo}/commits/${commit}/check-runs`,
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
            throw new Error(response.body.message);
          }

          if (response.statusCode === 304) {
            break;
          }

          result = response.body.check_runs.find(({ name }) => name === context);

          if (result && result.status === 'completed') {
            return result;
          }

          options.etag = response.headers.etag;

          break;
        }
        default:
          throw new Error(`git server ${url.host} not recognized`);
      }

      // https://github.com/watson/ci-info/pull/42
      if (!result && !(ci.isPR || process.env.GITHUB_EVENT_NAME === 'pull_request')) {
        return null;
      }

      setTimeout(getStatus, interval, options);
    }

    getStatus();
  });
}

module.exports = {
  getStatus
};

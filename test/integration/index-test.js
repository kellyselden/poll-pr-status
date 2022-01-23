'use strict';

const { describe, setUpObjectReset, setUpSinon } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const { gitInit } = require('git-fixtures');
const ci = require('ci-info');
const { getStatus } = require('../..');

const repo = 'test-org/test-repo';
const repository = `https://github.com/${repo}.git`;
const commit = 'test-commit';
const context = 'test context';
const token = 'test token';
const etag = 'test etag';
const name = require('../../package').name;

describe(function() {
  setUpObjectReset(process.env);
  setUpObjectReset(ci);
  setUpSinon();

  beforeEach(function() {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_EVENT_NAME;

    ci.isPR = false;
  });

  it('uses passed in commit', async function() {
    let request = this.sinon.stub()
      .resolves({
        body: {
          'check_runs': [
            {
              status: 'completed'
            }
          ]
        }
      });

    await getStatus({
      request,
      commit,
      repository
    });

    expect(request).to.be.calledWith(this.sinon.match({
      url: `https://api.github.com/repos/${repo}/commits/${commit}/check-runs`
    }));
  });

  it('adds repo user agent', async function() {
    let request = this.sinon.stub()
      .resolves({
        body: {
          'check_runs': [
            {
              status: 'completed'
            }
          ]
        }
      });

    await getStatus({
      request,
      commit,
      repository
    });

    expect(request).to.be.calledWith(this.sinon.match({
      headers: {
        'User-Agent': repo
      }
    }));
  });

  it('adds auth header', async function() {
    let request = this.sinon.stub()
      .resolves({
        body: {
          'check_runs': [
            {
              status: 'completed'
            }
          ]
        }
      });

    await getStatus({
      request,
      commit,
      repository,
      token
    });

    expect(request).to.be.calledWith(this.sinon.match({
      headers: {
        'Authorization': `token ${token}`
      }
    }));
  });

  it('returns status', async function() {
    let expected = {
      status: 'completed'
    };

    let request = this.sinon.stub()
      .resolves({
        body: {
          'check_runs': [
            expected
          ]
        }
      });

    let actual = await getStatus({
      request,
      commit,
      repository
    });

    expect(actual).to.equal(expected);
  });

  it('uses context', async function() {
    let expected = {
      status: 'completed',
      name: context
    };

    let request = this.sinon.stub()
      .resolves({
        body: {
          'check_runs': [
            {
              status: 'completed'
            },
            expected
          ]
        }
      });

    let actual = await getStatus({
      request,
      commit,
      repository,
      context
    });

    expect(actual).to.equal(expected);
  });

  describe('timing out', function() {
    it('works', async function() {
      let promise = getStatus({
        commit,
        repository,
        timeout: 0
      });

      await expect(promise).to.eventually.be.rejectedWith(`${name} has timed out`);
    });

    it('works after first loop', async function() {
      let request = this.sinon.stub()
        .resolves({
          headers: {},
          body: {
            'check_runs': [
              {
                status: 'foo'
              }
            ]
          }
        });

      let clock = this.sinon.useFakeTimers(1641085939689);

      let setTimeout = this.sinon.stub().callsFake((...args) => {
        global.setTimeout(...args);

        clock.tick(1);
        clock.runAll();
      });

      let promise = getStatus({
        setTimeout,
        request,
        commit,
        repository,
        interval: 0,
        timeout: 1
      });

      await expect(promise).to.eventually.be.rejectedWith(`${name} has timed out`);
    });
  });

  it('sets up etag', async function() {
    let request = this.sinon.stub()
      .onFirstCall()
      .resolves({
        headers: {
          etag
        },
        body: {
          'check_runs': [
            {
              status: 'foo'
            }
          ]
        }
      })
      .onSecondCall()
      .rejects();

    let promise = getStatus({
      request,
      commit,
      repository,
      interval: 0
    });

    await expect(promise).to.eventually.be.rejected;

    expect(request.firstCall.firstArg.headers).to.not.have.property('If-None-Match');
    expect(request.secondCall.firstArg.headers).to.have.property('If-None-Match', etag);
  });

  it('304 exits', async function() {
    let expected = null;

    let request = this.sinon.stub()
      .resolves({
        statusCode: 304
      });

    let actual = await getStatus({
      request,
      commit,
      repository,
      interval: 0
    });

    expect(actual).to.equal(expected);
  });

  it('CI server not recognized', async function() {
    let promise = getStatus({});

    await expect(promise).to.eventually.be.rejectedWith('CI server not recognized');
  });

  it('403 throws', async function() {
    let request = this.sinon.stub()
      .resolves({
        statusCode: 403,
        body: { message: 'test message' }
      });

    let promise = getStatus({
      request,
      commit,
      repository
    });

    await expect(promise).to.eventually.be.rejectedWith('test message');
  });

  it('doesn\'t hang on error', async function() {
    let promise = getStatus({});

    await expect(promise).to.eventually.be.rejected;
  });

  it('Travis CI PR commit', async function() {
    ci.TRAVIS = true;
    ci.isPR = true;
    process.env.TRAVIS_PULL_REQUEST_SHA = commit;

    let request = this.sinon.stub().rejects(new Error('test error'));

    let promise = getStatus({
      request,
      repository
    });

    await expect(promise).to.eventually.be.rejected;

    expect(request).to.be.calledWith(this.sinon.match({
      url: `https://api.github.com/repos/${repo}/commits/${commit}/check-runs`
    }));
  });

  it('Travis CI master commit', async function() {
    ci.TRAVIS = true;
    ci.isPR = false;
    process.env.TRAVIS_COMMIT = commit;

    let request = this.sinon.stub().rejects(new Error('test error'));

    let promise = getStatus({
      request,
      repository
    });

    await expect(promise).to.eventually.be.rejected;

    expect(request).to.be.calledWith(this.sinon.match({
      url: `https://api.github.com/repos/${repo}/commits/${commit}/check-runs`
    }));
  });

  describe('git init', function() {
    let cwd;

    beforeEach(async function() {
      cwd = await gitInit();
    });

    async function git(...args) {
      return (await (await import('execa')).execa('git', args, { cwd })).stdout;
    }

    async function writeFile(path, ...args) {
      await require('fs').promises.writeFile(require('path').join(cwd, path), ...args);
    }

    async function createMergeCommit() {
      let originalBranch = await git('branch', '--show-current');
      let tempBranch = 'temp';
      await git('checkout', '-b', tempBranch);
      await writeFile('temp', '');
      await git('add', '.');
      await git('commit', '-m', 'test');
      let preMergeCommit = await git('rev-parse', 'HEAD');
      await git('checkout', originalBranch);
      await git('merge', '--no-ff', tempBranch);
      return preMergeCommit;
    }

    it('GitHub Actions commit', async function() {
      process.env.GITHUB_ACTIONS = 'true';

      let commit = await createMergeCommit();

      let request = this.sinon.stub()
        .resolves({
          body: {
            'check_runs': [
              {
                status: 'completed'
              }
            ]
          }
        });

      await getStatus({
        cwd,
        request,
        repository
      });

      expect(request).to.be.calledWith(this.sinon.match({
        url: `https://api.github.com/repos/${repo}/commits/${commit}/check-runs`
      }));
    });

    describe('package.json repository', function() {
      it('string', async function() {
        let host = 'test-host.com';
        let repository = `https://${host}/${repo}.git`;

        await writeFile('package.json', JSON.stringify({ repository }));

        let promise = getStatus({
          cwd,
          commit
        });

        await expect(promise).to.eventually.be.rejectedWith(`git server ${host} not recognized`);
      });

      it('object', async function() {
        let host = 'test-host.com';
        let repository = { url: `https://${host}/${repo}.git` };

        await writeFile('package.json', JSON.stringify({ repository }));

        let promise = getStatus({
          cwd,
          commit
        });

        await expect(promise).to.eventually.be.rejectedWith(`git server ${host} not recognized`);
      });
    });
  });
});

# poll-pr-status

[![npm version](https://badge.fury.io/js/poll-pr-status.svg)](https://badge.fury.io/js/poll-pr-status)

Poll for pull request statuses

## Usage

```js
const { getStatus } = require('poll-pr-status');

let status = await getStatus({
  context: 'netlify/your-app-name/deploy-preview'
});

let url = status ? status.target_url : 'https://your-app-name.netlify.com';
```

`status` can be `null` if it is not a pull request.

## Options

```js
await getStatus({
  // required
  context: 'your status identifier',

  // optional
  repository: 'https://github.com/you/your-app-name.git',

  // optional
  commit: '45a2ccf3e57a83247bc03fbdd03569cfca1ed4f7',

  // optional
  interval: 1000
});
```

## Support

GitHub
GitHub Actions
Travis CI

# AutoUpdater

Compare local package.json and remote package.json and if versions don't match, copy remote files

# Installation

`npm install gh-autoupdater`

# How it works?

- Compare local version with remote version
- If versions don't match, download the repository
- Copy files to local
- Compare local dependencies with remote dependencies
- If dependencies don't match, install the remote dependencies

# Config

- `repo: 'http://github.com/user/repo'` - The url to the root of a git repository to update from.
- `branch: 'main'` - The branch to update from.
- `temp: './temp-update'` - The local dir to save temporary information for the update.
- `ignore: ['.git',...]` - An array of files for not copiyng when updating.
- `testing: false` - If true, copy update inside ./testing folder.
- `dev: false` - If true, ignore the update.

This values are the default values

# Events

- `out-dated(localVersion, remoteVersion)` - Local version is out-dated
- `up-to-date(version)` - Versions match
- `download.start(repo)` - Download started from the repository
- `download.end` - Files downloaded
- `update.start` - Copying files from "tepm folder"
- `modules.start` - Installing dependencies
- `modules.end(modules)` - Dependencies installed
- `end` - All is over

# Example

```javascript
const AutoUpdate = require('');

const update = new AutoUpdate({
  repo: 'https://github.com/user/repo',
  branch: 'main',
  temp: './temp-update',
  testing: false,
});

// Initialize update
update.autoUpdate();

// Events
update.on('out-dated', (local, remote) => {
  console.log('Out-dated: Local-' + local + ' Remote-' + remote);
});
update.on('up-to-date', (local) => {
  console.log('Up to date: local-' + local);
});
update.on('modules.start', () => {
  console.log('Updating dependencies...');
});
update.on('modules.end', (modules) => {
  console.log('Dependencies updated: ');
  console.log(modules);
});
update.on('download.start', (repo) => {
  console.log('Downloading files from: ' + repo);
});
update.on('download.end', () => {
  console.log('Files downloaded');
});
update.on('update.start', () => {
  console.log('Copying files...');
});
update.on('end', () => {
  console.log('Application updated');
});
```

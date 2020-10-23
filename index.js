const fs = require('fs-extra');
const axios = require('axios');
const simpleGit = require('simple-git');
const path = require('path');
const rmdir = require('rimraf');
const EventEmitter = require('events');
const compare = require('compare-versions');
const { execSync } = require('child_process');

const git = simpleGit();

class AutoUpdate extends EventEmitter {
  constructor(updateConfig) {
    /**
     * @param {String} repo - The url to the root of a git repository to update from.
     * @param {String} branch - The branch to update from. Defaults to main.
     * @param {String} temp - The local dir to save temporary information for the update.
     * @param {Array[String]} ignore - An array of files to not install when updating.
     * @param {Boolean} testing - If true, copy update inside ./testing folder
     * @param {Boolean} dev - If true, ignore update
     */
    if (updateConfig.repo === undefined)
      throw new Error('You must incluede a repository link');
    if (updateConfig.branch === undefined) updateConfig.branch = 'main';
    if (updateConfig.temp === undefined) updateConfig.temp = './temp-update';
    if (updateConfig.ignore === undefined) updateConfig.ignore = ['.git'];
    else updateConfig.ignore.push('.git');
    if (updateConfig.testing === undefined) updateConfig.testing = false;
    const gitFolder = fs.readdirSync('./').some((file) => file === '.git');
    if (updateConfig.dev === undefined && !gitFolder) updateConfig.dev = false;
    if (gitFolder) {
      updateConfig.dev = true;
    }
    if (updateConfig.command === undefined) updateConfig.index = false;
    super(
      updateConfig.repo,
      updateConfig.branch,
      updateConfig.temp,
      updateConfig.ignore,
      updateConfig.testing,
      updateConfig.dev,
      updateConfig.command
    );
    this.repo = updateConfig.repo;
    this.branch = updateConfig.branch;
    this.temp = updateConfig.temp;
    this.ignore = updateConfig.ignore;
    this.testing = updateConfig.testing;
    this.dev = updateConfig.dev;
    this.command = updateConfig.command;
  }

  /**
   * Check local version and dependencies in package.json
   * @returns - An object with the version and dependencies
   */
  localVersion() {
    const { version, dependencies } = JSON.parse(
      fs.readFileSync('./package.json', { encoding: 'utf8' })
    );
    return { version, modules: dependencies };
  }

  /**
   * Check remote version and dependencies in packeage.json
   * @returns - An object with the version and dependencies
   */
  async remoteVersion() {
    const pkg = `https://raw.githubusercontent.com/${this.repo
      .split('/')
      .slice(3)
      .join('/')}/${this.branch}/package.json`;
    const { data } = await axios.get(pkg);
    return { version: data.version, modules: data.dependencies };
  }

  /**
   * Compare version in local and remote package.json
   * @returns An object with the result of the version comparation and the version number
   */
  async compareVersions() {
    const local = this.localVersion();
    const remote = await this.remoteVersion();
    if (compare(remote.version, remote.version) !== 1) {
      this.emit('out-dated', local.version, remote.version);
      return { upToDate: false, local: local.version, remote: remote.version };
    }
    this.emit('up-to-date', local.version);
    return { upToDate: true, local: local.version };
  }

  /**
   * Compare dependencies in local and remote package.json
   * @returns An object with the result of the version comparation and remote dependencies
   */
  async compareModules() {
    const local = this.localVersion();
    const remote = await this.remoteVersion();
    for (const key in remote.modules) {
      const remoteModule = remote.modules[key];
      const localModule = local.modules[key];
      if (
        localModule == undefined ||
        compare(remoteModule.slice(1), localModule.slice(1)) !== 1
      )
        return { upToDate: false, modules: remote.modules };
    }
    return { upToDate: true, modules: remote.modules };
  }

  /**
   * Update package dependencies
   */
  async modulesUpdate() {
    if (!this.testing) {
      this.emit('modules.start');
      const { updateToDate, modules } = await this.compareModules();
      if (!updateToDate) {
        execSync('npm install');
        return this.emit('modules.end', modules);
      }
    }
  }

  /**
   * Initialize all the process
   */
  async autoUpdate() {
    if (!this.dev) {
      const version = await this.compareVersions();
      if (!version.upToDate) {
        await this.forceUpdate();
        await this.modulesUpdate();
      }
    }
    return this.emit('end');
  }

  /**
   * Download the git repository, purge ignored files and copy files from temp folder to application folder
   */
  async forceUpdate() {
    await this.downloadUpdate();
    await this.installUpdate();
  }

  /**
   * Download the git repository
   */
  async downloadUpdate() {
    this.emit('download.start', this.repo);
    await fs.ensureDir(this.temp);
    await fs.emptyDir(this.temp);
    await git.clone(this.repo, this.temp);
    return this.emit('download.end', this.repo);
  }

  /**
   * Purge ignored files and copy files from temp folder to application folder
   */
  async installUpdate() {
    this.emit('update.start');
    if (this.ignore) {
      this.ignore.forEach((file) => {
        file = path.join(this.temp, file);
        if (fs.existsSync(file)) {
          if (fs.lstatSync(file).isDirectory()) {
            rmdir.sync(file);
          } else {
            fs.unlinkSync(file);
          }
        }
      });
    }
    let destination = this.testing ? './testing/' : './';
    fs.ensureDirSync(destination);
    fs.copySync(this.temp, destination);
    fs.removeSync(this.temp);
  }
}

module.exports = AutoUpdate;

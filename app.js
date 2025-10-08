'use strict';

const Homey = require('homey');
const PetKitClient = require('./lib/petkit-api');

class PetkitApp extends Homey.App {

  async onInit() {
    this.log('Petkit app has been initialized');

    // Register flow card actions
    this.registerFlowCards();
  }

  async onUninit() {
    this.log('Petkit app has been uninitialized');
  }

  registerFlowCards() {
    // Flow cards are handled by individual drivers
    this.log('Flow cards registered');
  }


  async getApiClient() {
    const username = this.homey.settings.get('username');
    const password = this.homey.settings.get('password');
    const region = this.homey.settings.get('region') || 'US';
    const timezone = this.homey.settings.get('timezone') || 'America/New_York';

    if (!username || !password) {
      throw new Error('Please configure your Petkit credentials in the app settings');
    }

    return new PetKitClient({ username, password, region, timezone });
  }

}

module.exports = PetkitApp;
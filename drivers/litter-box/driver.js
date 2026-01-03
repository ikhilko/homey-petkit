'use strict';

const Homey = require('homey');

class LitterBoxDriver extends Homey.Driver {

  async onInit() {
    this.log('Petkit Litter Box Driver has been initialized');

    // Register flow card actions
    this.homey.flow.getActionCard('start_cleaning')
      .registerRunListener(this._onFlowActionStartCleaning.bind(this));
  }

  async onPair(session) {
    let username = '';
    let password = '';
    let api = null;

    session.setHandler('login', async (data) => {
      username = data.username;
      password = data.password;

      // Validate credentials
      const { PetKitClient } = require('../../lib/petkit-api');
      const region = this.homey.settings.get('api_region') || 'DE';
      api = new PetKitClient({ username, password, region });

      try {
        await api.login();
        return true;
      } catch (error) {
        this.error('Login failed:', error);
        throw new Error(this.homey.__('pair.login_failed'));
      }
    });

    session.setHandler('list_devices', async () => {
      if (!api) {
        throw new Error('Not logged in');
      }

      try {
        const devices = await api.getDevices();
        const litterBoxes = devices.filter(device => device.type === 'Litter');

        return litterBoxes.map(litterBox => ({
          name: litterBox.deviceNfo?.deviceName || `Petkit Litter Box ${litterBox.deviceNfo?.deviceId}`,
          data: {
            id: litterBox.deviceNfo?.deviceId,
            type: litterBox.type
          },
          store: {
            username,
            password
          }
        }));
      } catch (error) {
        this.error('Failed to get devices:', error);
        throw new Error(this.homey.__('pair.device_list_failed'));
      }
    });
  }

  async _onFlowActionStartCleaning(args) {
    return args.device.startCleaning();
  }

}

module.exports = LitterBoxDriver;
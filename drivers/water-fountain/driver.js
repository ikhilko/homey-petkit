'use strict';

const Homey = require('homey');

class WaterFountainDriver extends Homey.Driver {

  async onInit() {
    this.log('Petkit Water Fountain Driver has been initialized');

    // Register flow card actions
    this.homey.flow.getActionCard('set_fountain_mode')
      .registerRunListener(this._onFlowActionSetMode.bind(this));
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
        const fountains = devices.filter(device => device.type === 'WaterFountain');

        return fountains.map(fountain => ({
          name: fountain.deviceNfo?.deviceName || `Petkit Water Fountain ${fountain.deviceNfo?.deviceId}`,
          data: {
            id: fountain.deviceNfo?.deviceId,
            type: fountain.type
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

  async _onFlowActionSetMode(args) {
    return args.device.setFountainMode(parseInt(args.mode));
  }

}

module.exports = WaterFountainDriver;
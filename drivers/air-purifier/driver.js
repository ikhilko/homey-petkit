'use strict';

const Homey = require('homey');

class AirPurifierDriver extends Homey.Driver {

  async onInit() {
    this.log('Petkit Air Purifier Driver has been initialized');

    // Register flow card actions
    this.homey.flow.getActionCard('set_purifier_mode')
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
      const PetkitAPI = require('../../lib/petkit-api');
      const region = this.homey.settings.get('api_region') || 'DE';
      api = new PetkitAPI({ username, password, region });

      try {
        await api.login();
        return true;
      } catch (error) {
        this.error('Login failed:', error);
        // Pass through the specific error message from the API
        throw new Error(error.message || this.homey.__('pair.login_failed'));
      }
    });

    session.setHandler('list_devices', async () => {
      if (!api) {
        throw new Error('Not logged in');
      }

      try {
        const devices = await api.getDevices();
        const purifiers = devices.filter(device => device.type === 'Purifier');

        return purifiers.map(purifier => ({
          name: purifier.deviceNfo?.deviceName || `Petkit Air Purifier ${purifier.deviceNfo?.deviceId}`,
          data: {
            id: purifier.deviceNfo?.deviceId,
            type: purifier.type
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
    return args.device.setPurifierMode(parseInt(args.mode));
  }

}

module.exports = AirPurifierDriver;
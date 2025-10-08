'use strict';

const Homey = require('homey');

class FeederDriver extends Homey.Driver {

  async onInit() {
    this.log('Petkit Feeder Driver has been initialized');

    // Register flow card actions
    this.homey.flow.getActionCard('feed_manual')
      .registerRunListener(this._onFlowActionFeedManual.bind(this));
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
        throw new Error(this.homey.__('pair.login_failed'));
      }
    });

    session.setHandler('list_devices', async () => {
      if (!api) {
        throw new Error('Not logged in');
      }

      try {
        const devices = await api.getDevices();
        const feeders = devices.filter(device => device.type === 'feeder');

        return feeders.map(feeder => ({
          name: feeder.name || `Petkit Feeder ${feeder.id}`,
          data: {
            id: feeder.id,
            type: feeder.type
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

  async _onFlowActionFeedManual(args) {
    return args.device.feedManual(args.amount);
  }

}

module.exports = FeederDriver;
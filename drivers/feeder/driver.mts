import Homey from 'homey';
import { PetKitClient, DeviceEntity, DEVICES_FEEDER } from '../../lib/petkit-api/index.mjs';

interface LoginData {
  username: string;
  password: string;
}

interface FlowActionArgs {
  device: FeederDevice;
  amount: number;
}

interface FeederDevice extends Homey.Device {
  feedManual(amount: number): Promise<boolean>;
}

interface PairingDevice {
  name: string;
  data: {
    id: number;
    type: string;
  };
  store: {
    username: string;
    password: string;
  };
}

class FeederDriver extends Homey.Driver {
  async onInit(): Promise<void> {
    this.log('Petkit Feeder Driver has been initialized');

    // Register flow card actions
    this.homey.flow
      .getActionCard('feed_manual')
      .registerRunListener(this._onFlowActionFeedManual.bind(this));
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {
    let username = '';
    let password = '';
    let api: PetKitClient | null = null;

    session.setHandler('login', async (data: LoginData): Promise<boolean> => {
      username = data.username;
      password = data.password;

      const region = this.homey.settings.get('api_region') as string || 'DE';
      api = new PetKitClient({ username, password, region });

      try {
        await api.login();
        return true;
      } catch (error) {
        this.error('Login failed:', error);
        throw new Error(this.homey.__('pair.login_failed'));
      }
    });

    session.setHandler('list_devices', async (): Promise<PairingDevice[]> => {
      if (!api) {
        throw new Error('Not logged in');
      }

      try {
        const devices = await api.getDevices();
        const feeders = devices.filter(
          (device: DeviceEntity) =>
            device.type === 'Feeder' ||
            (DEVICES_FEEDER as readonly string[]).includes(device.deviceNfo?.deviceType?.toLowerCase() || '')
        );

        return feeders.map((feeder: DeviceEntity): PairingDevice => ({
          name: feeder.deviceNfo?.deviceName || `Petkit Feeder ${feeder.deviceNfo?.deviceId}`,
          data: {
            id: feeder.deviceNfo?.deviceId ?? 0,
            type: feeder.type,
          },
          store: {
            username,
            password,
          },
        }));
      } catch (error) {
        this.error('Failed to get devices:', error);
        throw new Error(this.homey.__('pair.device_list_failed'));
      }
    });
  }

  private async _onFlowActionFeedManual(args: FlowActionArgs): Promise<boolean> {
    return args.device.feedManual(args.amount);
  }
}

export default FeederDriver;

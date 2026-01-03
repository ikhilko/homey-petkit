import Homey from 'homey';
import { PetKitClient, DeviceEntity, DEVICES_LITTER_BOX } from '../../lib/petkit-api/index.mjs';

interface LoginData {
  username: string;
  password: string;
}

interface FlowActionArgs {
  device: LitterBoxDevice;
}

interface LitterBoxDevice extends Homey.Device {
  startCleaning(): Promise<boolean>;
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

class LitterBoxDriver extends Homey.Driver {
  async onInit(): Promise<void> {
    this.log('Petkit Litter Box Driver has been initialized');

    // Register flow card actions
    this.homey.flow
      .getActionCard('start_cleaning')
      .registerRunListener(this._onFlowActionStartCleaning.bind(this));
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
        const litterBoxes = devices.filter(
          (device: DeviceEntity) =>
            device.type === 'Litter' ||
            (DEVICES_LITTER_BOX as readonly string[]).includes(device.deviceNfo?.deviceType?.toLowerCase() || '')
        );

        return litterBoxes.map((litterBox: DeviceEntity): PairingDevice => ({
          name: litterBox.deviceNfo?.deviceName || `Petkit Litter Box ${litterBox.deviceNfo?.deviceId}`,
          data: {
            id: litterBox.deviceNfo?.deviceId ?? 0,
            type: litterBox.type,
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

  private async _onFlowActionStartCleaning(args: FlowActionArgs): Promise<boolean> {
    return args.device.startCleaning();
  }
}

export default LitterBoxDriver;

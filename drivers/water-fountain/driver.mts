import Homey from 'homey';
import { PetKitClient, DeviceEntity, DEVICES_WATER_FOUNTAIN } from '../../lib/petkit-api/index.mjs';

interface LoginData {
  username: string;
  password: string;
}

interface FlowActionArgs {
  device: WaterFountainDevice;
  mode: string;
}

interface WaterFountainDevice extends Homey.Device {
  setFountainMode(mode: number): Promise<boolean>;
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

class WaterFountainDriver extends Homey.Driver {
  async onInit(): Promise<void> {
    this.log('Petkit Water Fountain Driver has been initialized');

    // Register flow card actions
    this.homey.flow
      .getActionCard('set_fountain_mode')
      .registerRunListener(this._onFlowActionSetMode.bind(this));
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
        const fountains = devices.filter(
          (device: DeviceEntity) =>
            device.type === 'WaterFountain' ||
            (DEVICES_WATER_FOUNTAIN as readonly string[]).includes(device.deviceNfo?.deviceType?.toLowerCase() || '')
        );

        return fountains.map((fountain: DeviceEntity): PairingDevice => ({
          name: fountain.deviceNfo?.deviceName || `Petkit Water Fountain ${fountain.deviceNfo?.deviceId}`,
          data: {
            id: fountain.deviceNfo?.deviceId ?? 0,
            type: fountain.type,
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

  private async _onFlowActionSetMode(args: FlowActionArgs): Promise<boolean> {
    return args.device.setFountainMode(parseInt(args.mode));
  }
}

export default WaterFountainDriver;

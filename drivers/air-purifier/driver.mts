import Homey from 'homey';
import { PetKitClient, DeviceEntity, DEVICES_PURIFIER } from '../../lib/petkit-api/index.mjs';

interface LoginData {
  username: string;
  password: string;
}

interface FlowActionArgs {
  device: AirPurifierDevice;
  mode: string;
}

interface AirPurifierDevice extends Homey.Device {
  setPurifierMode(mode: number, fanSpeed?: number | null): Promise<boolean>;
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

class AirPurifierDriver extends Homey.Driver {
  async onInit(): Promise<void> {
    this.log('Petkit Air Purifier Driver has been initialized');

    // Register flow card actions
    this.homey.flow
      .getActionCard('set_purifier_mode')
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
        // Pass through the specific error message from the API
        throw new Error((error as Error).message || this.homey.__('pair.login_failed'));
      }
    });

    session.setHandler('list_devices', async (): Promise<PairingDevice[]> => {
      if (!api) {
        throw new Error('Not logged in');
      }

      try {
        const devices = await api.getDevices();
        const purifiers = devices.filter(
          (device: DeviceEntity) =>
            device.type === 'Purifier' ||
            (DEVICES_PURIFIER as readonly string[]).includes(device.deviceNfo?.deviceType?.toLowerCase() || '')
        );

        return purifiers.map((purifier: DeviceEntity): PairingDevice => ({
          name: purifier.deviceNfo?.deviceName || `Petkit Air Purifier ${purifier.deviceNfo?.deviceId}`,
          data: {
            id: purifier.deviceNfo?.deviceId ?? 0,
            type: purifier.type,
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
    return args.device.setPurifierMode(parseInt(args.mode));
  }
}

export default AirPurifierDriver;

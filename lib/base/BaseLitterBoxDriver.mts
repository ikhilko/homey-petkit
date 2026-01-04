import Homey from 'homey';
import { PetKitClient, DeviceEntity, DeviceType } from '../petkit-api/index.mjs';

interface LoginData {
  username: string;
  password: string;
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

interface BaseLitterBoxDeviceInterface extends Homey.Device {
  startCleaning(): Promise<boolean>;
}

interface FlowActionArgs {
  device: BaseLitterBoxDeviceInterface;
}

/**
 * Base class for all PetKit litter box drivers.
 * Handles common pairing flow and flow card registration.
 * Model-specific drivers should extend this class.
 */
abstract class BaseLitterBoxDriver extends Homey.Driver {
  /**
   * Override in subclass to return the model name for logging
   */
  protected abstract getModelName(): string;

  /**
   * Override in subclass to return the device types to filter during pairing
   */
  protected abstract getSupportedDeviceTypes(): DeviceType[];

  async onInit(): Promise<void> {
    this.log(`${this.getModelName()} Driver has been initialized`);

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
        const supportedTypes = this.getSupportedDeviceTypes();

        // Filter devices to only show supported litter box types
        const filteredDevices = devices.filter((device: DeviceEntity) => {
          if (device.type !== 'Litter') {
            return false;
          }
          const deviceType = device.deviceNfo?.deviceType?.toLowerCase() || '';
          return supportedTypes.includes(deviceType as DeviceType);
        });

        return filteredDevices.map((device: DeviceEntity): PairingDevice => ({
          name: device.deviceNfo?.deviceName || `${this.getModelName()} ${device.deviceNfo?.deviceId}`,
          data: {
            id: device.deviceNfo?.deviceId ?? 0,
            type: device.deviceNfo?.deviceType || device.type,
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

export default BaseLitterBoxDriver;

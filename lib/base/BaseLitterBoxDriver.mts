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
    let api: PetKitClient | null = null;

    // Handle loading page - check for existing credentials
    session.setHandler('showView', async (viewId: string): Promise<void> => {
      if (viewId === 'loading') {
        const storedUsername = this.homey.settings.get('petkit_username') as string;
        const storedPassword = this.homey.settings.get('petkit_password') as string;

        if (storedUsername && storedPassword) {
          this.log('Credentials found in settings, attempting login');
          const region = this.homey.settings.get('api_region') as string || 'DE';
          api = new PetKitClient({ username: storedUsername, password: storedPassword, region });

          try {
            await api.login();
            this.log('Login successful, showing device list');
            await session.showView('list_devices');
          } catch (error) {
            this.error('Stored credentials failed:', error);
            await session.showView('login_credentials');
          }
        } else {
          this.log('No credentials found, showing login');
          await session.showView('login_credentials');
        }
      }
    });

    session.setHandler('login', async (data: LoginData): Promise<boolean> => {
      const { username, password } = data;

      const region = this.homey.settings.get('api_region') as string || 'DE';
      api = new PetKitClient({ username, password, region });

      try {
        await api.login();

        // Store credentials in app settings (shared across all devices)
        this.homey.settings.set('petkit_username', username);
        this.homey.settings.set('petkit_password', password);

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

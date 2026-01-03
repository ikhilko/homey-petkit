import Homey from 'homey';
import { PetKitClient, PurifierStatus, PurMode } from '../../lib/petkit-api/index.mjs';

interface DeviceData {
  id: number;
  type: string;
}

interface DeviceStore {
  username: string;
  password: string;
}

interface DeviceSettings {
  poll_interval?: number;
}

class AirPurifierDevice extends Homey.Device {
  private api!: PetKitClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async onInit(): Promise<void> {
    this.log('Petkit Air Purifier Device has been initialized');

    const store = this.getStore() as DeviceStore;
    const region = this.homey.settings.get('api_region') as string || 'DE';
    this.api = new PetKitClient({
      username: store.username,
      password: store.password,
      region: region,
    });

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));

    // Add custom capabilities
    if (!this.hasCapability('measure_pm25')) {
      await this.addCapability('measure_pm25');
    }
    if (!this.hasCapability('meter_filter_life')) {
      await this.addCapability('meter_filter_life');
    }
    if (!this.hasCapability('purifier_mode')) {
      await this.addCapability('purifier_mode');
    }

    // Start polling for device status
    this.startPolling();

    const deviceData = this.getData() as DeviceData;
    this.log('Air purifier device initialized with ID:', deviceData.id);
  }

  async onAdded(): Promise<void> {
    this.log('Petkit Air Purifier has been added');
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: DeviceSettings;
    newSettings: DeviceSettings;
    changedKeys: string[];
  }): Promise<void> {
    this.log('Petkit Air Purifier settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(_name: string): Promise<void> {
    this.log('Petkit Air Purifier was renamed');
  }

  async onDeleted(): Promise<void> {
    this.log('Petkit Air Purifier has been deleted');
    this.stopPolling();
  }

  private async onCapabilityOnoff(value: boolean, _opts: object): Promise<void> {
    try {
      const mode = value ? PurMode.AUTO_MODE : PurMode.STANDARD_MODE; // 0 = auto, 2 = sleep (off)
      await this.setPurifierMode(mode);
    } catch (error) {
      this.error('Failed to set power state:', error);
      throw error;
    }
  }

  private async onCapabilityDim(value: number, _opts: object): Promise<void> {
    try {
      // Convert 0-1 range to fan speed levels (0-3)
      const fanSpeed = Math.round(value * 3);
      const mode = PurMode.SILENT_MODE; // Manual mode
      await this.setPurifierMode(mode, fanSpeed);
    } catch (error) {
      this.error('Failed to set fan speed:', error);
      throw error;
    }
  }

  async setPurifierMode(mode: PurMode, fanSpeed: number | null = null): Promise<boolean> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;

      await this.api.setPurifierMode(deviceId, mode);

      this.log(`Purifier mode set to: ${mode}${fanSpeed !== null ? `, fan speed: ${fanSpeed}` : ''}`);

      // Update capabilities
      await this.setCapabilityValue('onoff', mode !== PurMode.STANDARD_MODE);
      await this.setCapabilityValue('purifier_mode', mode.toString());

      if (fanSpeed !== null) {
        await this.setCapabilityValue('dim', fanSpeed / 3);
      }

      // Trigger flow
      await this.homey.flow
        .getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: mode === PurMode.STANDARD_MODE ? 'off' : 'on' });

      return true;
    } catch (error) {
      this.error('Failed to set purifier mode:', error);
      throw error;
    }
  }

  private async updateDeviceStatus(): Promise<void> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;
      const status: PurifierStatus = await this.api.getPurifierStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_pm25', status.airQuality);
      await this.setCapabilityValue('meter_filter_life', status.filterLife);
      await this.setCapabilityValue('onoff', status.mode !== PurMode.STANDARD_MODE);
      await this.setCapabilityValue('purifier_mode', status.mode.toString());
      await this.setCapabilityValue('dim', status.fanSpeed / 3);

      // Update availability
      await this.setAvailable();

      this.log('Device status updated:', status);
    } catch (error) {
      this.error('Failed to update device status:', error);
      await this.setUnavailable(this.homey.__('device.unavailable'));
    }
  }

  private startPolling(): void {
    this.stopPolling();

    const settings = this.getSettings() as DeviceSettings;
    const interval = (settings.poll_interval || 300) * 1000; // Convert to milliseconds

    this.pollInterval = setInterval(() => {
      this.updateDeviceStatus();
    }, interval);

    // Initial update
    this.updateDeviceStatus();
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export default AirPurifierDevice;

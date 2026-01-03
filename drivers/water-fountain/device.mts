import Homey from 'homey';
import { PetKitClient, FountainStatus } from '../../lib/petkit-api/index.mjs';

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
  low_water_threshold?: number;
}

class WaterFountainDevice extends Homey.Device {
  private api!: PetKitClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async onInit(): Promise<void> {
    this.log('Petkit Water Fountain Device has been initialized');

    const store = this.getStore() as DeviceStore;
    const region = this.homey.settings.get('api_region') as string || 'DE';
    this.api = new PetKitClient({
      username: store.username,
      password: store.password,
      region: region,
    });

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    // Add custom capabilities
    if (!this.hasCapability('measure_water_level')) {
      await this.addCapability('measure_water_level');
    }
    if (!this.hasCapability('meter_filter_life')) {
      await this.addCapability('meter_filter_life');
    }
    if (!this.hasCapability('fountain_mode')) {
      await this.addCapability('fountain_mode');
    }

    // Start polling for device status
    this.startPolling();

    const deviceData = this.getData() as DeviceData;
    this.log('Water fountain device initialized with ID:', deviceData.id);
  }

  async onAdded(): Promise<void> {
    this.log('Petkit Water Fountain has been added');
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
    this.log('Petkit Water Fountain settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(_name: string): Promise<void> {
    this.log('Petkit Water Fountain was renamed');
  }

  async onDeleted(): Promise<void> {
    this.log('Petkit Water Fountain has been deleted');
    this.stopPolling();
  }

  private async onCapabilityOnoff(value: boolean, _opts: object): Promise<void> {
    try {
      const mode = value ? 1 : 0; // 1 = smart mode (pump on), 0 = normal mode (pump off)
      await this.setFountainMode(mode);
    } catch (error) {
      this.error('Failed to set pump state:', error);
      throw error;
    }
  }

  async setFountainMode(mode: number): Promise<boolean> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;
      await this.api.setFountainMode(deviceId, mode);

      this.log(`Fountain mode set to: ${mode}`);

      // Update capabilities
      await this.setCapabilityValue('onoff', mode === 1);
      await this.setCapabilityValue('fountain_mode', mode.toString());

      // Trigger flow
      await this.homey.flow
        .getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: mode === 1 ? 'pump_on' : 'pump_off' });

      return true;
    } catch (error) {
      this.error('Failed to set fountain mode:', error);
      throw error;
    }
  }

  private async updateDeviceStatus(): Promise<void> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;
      const status: FountainStatus = await this.api.getFountainStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_water_level', status.waterLevel);
      await this.setCapabilityValue('meter_filter_life', status.filterLife);
      await this.setCapabilityValue('onoff', status.pumpRunning);
      await this.setCapabilityValue('fountain_mode', status.mode.toString());

      // Check for low water alert
      const settings = this.getSettings() as DeviceSettings;
      const lowWaterThreshold = settings.low_water_threshold || 20;

      if (status.waterLevel <= lowWaterThreshold) {
        // Trigger low water flow
        await this.homey.flow
          .getDeviceTriggerCard('fountain_low_water')
          .trigger(this, { water_level: status.waterLevel });
      }

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

export default WaterFountainDevice;

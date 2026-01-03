import Homey from 'homey';
import { PetKitClient, LitterStatus } from '../../lib/petkit-api/index.mjs';

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
  high_waste_threshold?: number;
}

class LitterBoxDevice extends Homey.Device {
  private api!: PetKitClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async onInit(): Promise<void> {
    this.log('Petkit Litter Box Device has been initialized');

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
    if (!this.hasCapability('measure_litter_level')) {
      await this.addCapability('measure_litter_level');
    }
    if (!this.hasCapability('measure_waste_level')) {
      await this.addCapability('measure_waste_level');
    }

    // Start polling for device status
    this.startPolling();

    const deviceData = this.getData() as DeviceData;
    this.log('Litter box device initialized with ID:', deviceData.id);
  }

  async onAdded(): Promise<void> {
    this.log('Petkit Litter Box has been added');
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
    this.log('Petkit Litter Box settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(_name: string): Promise<void> {
    this.log('Petkit Litter Box was renamed');
  }

  async onDeleted(): Promise<void> {
    this.log('Petkit Litter Box has been deleted');
    this.stopPolling();
  }

  private async onCapabilityOnoff(value: boolean, _opts: object): Promise<void> {
    if (value) {
      // Start cleaning when turned "on"
      await this.startCleaning();
    }
  }

  async startCleaning(): Promise<boolean> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;
      await this.api.startCleaning(deviceId);

      this.log('Cleaning cycle started');

      // Trigger flow
      await this.homey.flow
        .getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: 'cleaning' });

      // Reset onoff capability after starting cleaning
      setTimeout(() => {
        this.setCapabilityValue('onoff', false).catch(this.error.bind(this));
      }, 1000);

      return true;
    } catch (error) {
      this.error('Failed to start cleaning:', error);
      throw error;
    }
  }

  private async updateDeviceStatus(): Promise<void> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;
      const status: LitterStatus = await this.api.getLitterStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_litter_level', status.litterLevel);
      await this.setCapabilityValue('measure_waste_level', status.wasteLevel);

      // Check for high waste alert
      const settings = this.getSettings() as DeviceSettings;
      const highWasteThreshold = settings.high_waste_threshold || 80;

      if (status.wasteLevel >= highWasteThreshold) {
        await this.setCapabilityValue('alarm_generic', true);

        // Trigger needs cleaning flow
        await this.homey.flow
          .getDeviceTriggerCard('litter_needs_cleaning')
          .trigger(this, { waste_level: status.wasteLevel });
      } else {
        await this.setCapabilityValue('alarm_generic', false);
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

export default LitterBoxDevice;

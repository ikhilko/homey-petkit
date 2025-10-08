'use strict';

const Homey = require('homey');
const PetkitAPI = require('../../lib/petkit-api');

class AirPurifierDevice extends Homey.Device {

  async onInit() {
    this.log('Petkit Air Purifier Device has been initialized');

    const store = this.getStore();
    const region = this.homey.settings.get('api_region') || 'DE';
    this.api = new PetkitAPI({
      username: store.username,
      password: store.password,
      region: region
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

    this.log('Air purifier device initialized with ID:', this.getData().id);
  }

  async onAdded() {
    this.log('Petkit Air Purifier has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Petkit Air Purifier settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(name) {
    this.log('Petkit Air Purifier was renamed');
  }

  async onDeleted() {
    this.log('Petkit Air Purifier has been deleted');
    this.stopPolling();
  }

  async onCapabilityOnoff(value, opts) {
    try {
      const mode = value ? 0 : 2; // 0 = auto, 2 = sleep (off)
      return this.setPurifierMode(mode);
    } catch (error) {
      this.error('Failed to set power state:', error);
      throw error;
    }
  }

  async onCapabilityDim(value, opts) {
    try {
      // Convert 0-1 range to fan speed levels (0-3)
      const fanSpeed = Math.round(value * 3);
      const mode = 1; // Manual mode
      return this.setPurifierMode(mode, fanSpeed);
    } catch (error) {
      this.error('Failed to set fan speed:', error);
      throw error;
    }
  }

  async setPurifierMode(mode, fanSpeed = null) {
    try {
      const deviceId = this.getData().id;
      const params = { mode };
      if (fanSpeed !== null) {
        params.fan_speed = fanSpeed;
      }

      await this.api.setPurifierMode(deviceId, mode);

      this.log(`Purifier mode set to: ${mode}${fanSpeed !== null ? `, fan speed: ${fanSpeed}` : ''}`);

      // Update capabilities
      await this.setCapabilityValue('onoff', mode !== 2);
      await this.setCapabilityValue('purifier_mode', mode.toString());

      if (fanSpeed !== null) {
        await this.setCapabilityValue('dim', fanSpeed / 3);
      }

      // Trigger flow
      await this.homey.flow.getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: mode === 2 ? 'off' : 'on' });

      return true;
    } catch (error) {
      this.error('Failed to set purifier mode:', error);
      throw error;
    }
  }

  async updateDeviceStatus() {
    try {
      const deviceId = this.getData().id;
      const status = await this.api.getPurifierStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_pm25', status.airQuality);
      await this.setCapabilityValue('meter_filter_life', status.filterLife);
      await this.setCapabilityValue('onoff', status.mode !== 2);
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

  startPolling() {
    this.stopPolling();

    const settings = this.getSettings();
    const interval = (settings.poll_interval || 300) * 1000; // Convert to milliseconds

    this.pollInterval = setInterval(() => {
      this.updateDeviceStatus();
    }, interval);

    // Initial update
    this.updateDeviceStatus();
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

}

module.exports = AirPurifierDevice;
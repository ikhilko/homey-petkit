'use strict';

const Homey = require('homey');
const { PetKitClient } = require('../../lib/petkit-api');

class LitterBoxDevice extends Homey.Device {

  async onInit() {
    this.log('Petkit Litter Box Device has been initialized');

    const store = this.getStore();
    const region = this.homey.settings.get('api_region') || 'DE';
    this.api = new PetKitClient({
      username: store.username,
      password: store.password,
      region: region
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

    this.log('Litter box device initialized with ID:', this.getData().id);
  }

  async onAdded() {
    this.log('Petkit Litter Box has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Petkit Litter Box settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(name) {
    this.log('Petkit Litter Box was renamed');
  }

  async onDeleted() {
    this.log('Petkit Litter Box has been deleted');
    this.stopPolling();
  }

  async onCapabilityOnoff(value, opts) {
    if (value) {
      // Start cleaning when turned "on"
      return this.startCleaning();
    }
    return Promise.resolve();
  }

  async startCleaning() {
    try {
      const deviceId = this.getData().id;
      await this.api.startCleaning(deviceId);

      this.log('Cleaning cycle started');

      // Trigger flow
      await this.homey.flow.getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: 'cleaning' });

      // Reset onoff capability after starting cleaning
      setTimeout(() => {
        this.setCapabilityValue('onoff', false).catch(this.error);
      }, 1000);

      return true;
    } catch (error) {
      this.error('Failed to start cleaning:', error);
      throw error;
    }
  }

  async updateDeviceStatus() {
    try {
      const deviceId = this.getData().id;
      const status = await this.api.getLitterStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_litter_level', status.litterLevel);
      await this.setCapabilityValue('measure_waste_level', status.wasteLevel);

      // Check for high waste alert
      const settings = this.getSettings();
      const highWasteThreshold = settings.high_waste_threshold || 80;

      if (status.wasteLevel >= highWasteThreshold) {
        await this.setCapabilityValue('alarm_generic', true);

        // Trigger needs cleaning flow
        await this.homey.flow.getDeviceTriggerCard('litter_needs_cleaning')
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

module.exports = LitterBoxDevice;
import Homey from 'homey';
import {
  PetKitClient,
  LitterStatus,
  DeviceRecord,
  DeviceEntity,
  PetOutContent,
  SprayOverContent,
  CleanOverContent,
} from '../petkit-api/index.mjs';

export interface LitterBoxDeviceData {
  id: number;
  type: string;
}

export interface LitterBoxDeviceStore {
  lastProcessedRecordTimestamp?: number;
}

export interface LitterBoxDeviceSettings {
  poll_interval?: number;
  high_waste_threshold?: number;
  record_stale_threshold?: number;
}

/**
 * Base class for all PetKit litter box devices.
 * Handles common functionality like polling, status updates, and cleaning commands.
 * Model-specific devices should extend this class.
 */
abstract class BaseLitterBoxDevice extends Homey.Device {
  protected api!: PetKitClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Override in subclass to return the model name for logging
   */
  protected abstract getModelName(): string;

  async onInit(): Promise<void> {
    this.log(`${this.getModelName()} Device has been initialized`);

    // Initialize API client with credentials from app settings
    this.initializeApiClient();

    // Listen for credential changes in app settings
    this.homey.settings.on('set', (key: string) => {
      if (key === 'petkit_username' || key === 'petkit_password') {
        this.log('Credentials changed, reinitializing API client');
        this.initializeApiClient();
      }
    });

    // Register capability listeners (subclasses add their own)
    await this.registerCapabilityListeners();

    // Ensure capabilities are added
    await this.ensureCapabilities();

    // Start polling for device status
    this.startPolling();

    const deviceData = this.getData() as LitterBoxDeviceData;
    this.log(`${this.getModelName()} device initialized with ID:`, deviceData.id);
  }

  /**
   * Initialize or reinitialize the API client with credentials from app settings
   */
  private initializeApiClient(): void {
    const username = this.homey.settings.get('petkit_username') as string;
    const password = this.homey.settings.get('petkit_password') as string;
    const region = this.homey.settings.get('api_region') as string || 'DE';

    if (!username || !password) {
      this.error('PetKit credentials not found in app settings');
      return;
    }

    this.api = new PetKitClient({
      username,
      password,
      region,
    });
  }

  /**
   * Override in subclass to add model-specific capabilities
   */
  protected async ensureCapabilities(): Promise<void> {
    if (!this.hasCapability('measure_litter_level')) {
      await this.addCapability('measure_litter_level');
    }
    if (!this.hasCapability('measure_waste_level')) {
      await this.addCapability('measure_waste_level');
    }
  }

  async onAdded(): Promise<void> {
    this.log(`${this.getModelName()} has been added`);
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: LitterBoxDeviceSettings;
    newSettings: LitterBoxDeviceSettings;
    changedKeys: string[];
  }): Promise<void> {
    this.log(`${this.getModelName()} settings were changed`);

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(_name: string): Promise<void> {
    this.log(`${this.getModelName()} was renamed`);
  }

  async onDeleted(): Promise<void> {
    this.log(`${this.getModelName()} has been deleted`);
    this.stopPolling();
  }

  /**
   * Override in subclass to register model-specific capability listeners
   */
  protected async registerCapabilityListeners(): Promise<void> {
    // Default implementation does nothing
    // Subclasses should override to register their button handlers
  }

  /**
   * Get the device ID for API calls
   */
  protected getDeviceId(): number {
    const deviceData = this.getData() as LitterBoxDeviceData;
    return deviceData.id;
  }

  /**
   * Override in subclass to handle model-specific status fields
   */
  protected async updateDeviceStatus(): Promise<void> {
    try {
      const deviceData = this.getData() as LitterBoxDeviceData;
      const deviceId = deviceData.id;
      const status: LitterStatus = await this.api.getLitterStatus(deviceId);

      // Update common capabilities
      await this.setCapabilityValue('measure_litter_level', status.litterLevel);
      await this.setCapabilityValue('measure_waste_level', status.wasteLevel);

      // Check for high waste alert
      const settings = this.getSettings() as LitterBoxDeviceSettings;
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

      // Process device records and trigger flows for new events
      await this.processDeviceRecords(status._raw as DeviceEntity);

      // Allow subclasses to handle model-specific status
      await this.onStatusUpdate(status);

      // Update availability
      await this.setAvailable();

      this.log('Device status updated:', status);
    } catch (error) {
      this.error('Failed to update device status:', error);
      await this.setUnavailable(this.homey.__('device.unavailable'));
    }
  }

  /**
   * Override in subclass to handle model-specific status updates
   */
  protected async onStatusUpdate(_status: LitterStatus): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override to handle model-specific fields
  }

  protected startPolling(): void {
    this.stopPolling();

    const settings = this.getSettings() as LitterBoxDeviceSettings;
    const interval = (settings.poll_interval || 300) * 1000;

    this.pollInterval = setInterval(() => {
      this.updateDeviceStatus();
    }, interval);

    // Initial update
    this.updateDeviceStatus();
  }

  protected stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Process device records and trigger flows for new events
   */
  private async processDeviceRecords(device: DeviceEntity): Promise<void> {
    try {
      let records = device.deviceRecords || [];

      // Get settings for staleness check
      const settings = this.getSettings() as LitterBoxDeviceSettings;
      const pollIntervalMinutes = (settings.poll_interval || 300) / 60;
      const staleThresholdMinutes = settings.record_stale_threshold || 5;

      // Use the maximum of poll interval and stale threshold to ensure records aren't
      // considered stale before the next poll has a chance to process them
      const effectiveThresholdMinutes = Math.max(pollIntervalMinutes, staleThresholdMinutes);

      // Handle midnight edge case: if we're within the effective threshold after midnight,
      // also fetch yesterday's records to avoid missing events near day boundary
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

      if (minutesSinceMidnight < effectiveThresholdMinutes) {
        this.log(`Within ${effectiveThresholdMinutes} minutes after midnight, fetching yesterday's records too`);
        const yesterdayRecords = await this.fetchYesterdayRecords();
        records = [...records, ...yesterdayRecords];
      }

      if (records.length === 0) {
        return;
      }

      // Flatten all records including nested subContent
      const allRecords = this.flattenRecords(records);
      if (allRecords.length === 0) {
        return;
      }

      // Deduplicate records by timestamp (in case same record appears in both days)
      const uniqueRecords = this.deduplicateRecords(allRecords);

      // Get last processed timestamp from store
      const lastProcessedTimestamp = this.getStoreValue('lastProcessedRecordTimestamp') as number | undefined || 0;

      const nowSeconds = Math.floor(Date.now() / 1000);
      const cutoffTimestamp = nowSeconds - (effectiveThresholdMinutes * 60);

      // Filter to only new records that aren't stale
      const newRecords = uniqueRecords.filter(record => {
        const timestamp = record.timestamp || 0;
        // Must be newer than last processed AND not stale
        return timestamp > lastProcessedTimestamp && timestamp >= cutoffTimestamp;
      });

      if (newRecords.length === 0) {
        // Still update the timestamp if we have records, to skip old ones
        const latestTimestamp = Math.max(...uniqueRecords.map(r => r.timestamp || 0));
        if (latestTimestamp > lastProcessedTimestamp) {
          await this.setStoreValue('lastProcessedRecordTimestamp', latestTimestamp);
        }
        return;
      }

      // Sort by timestamp ascending to process in order
      newRecords.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      this.log(`Processing ${newRecords.length} new device records`);

      // Process each new record
      for (const record of newRecords) {
        await this.triggerRecordEvent(record);
      }

      // Update last processed timestamp
      const latestTimestamp = Math.max(...newRecords.map(r => r.timestamp || 0));
      await this.setStoreValue('lastProcessedRecordTimestamp', latestTimestamp);

    } catch (error) {
      this.error('Failed to process device records:', error);
    }
  }

  /**
   * Fetch yesterday's device records
   */
  private async fetchYesterdayRecords(): Promise<DeviceRecord[]> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr =
        yesterday.getFullYear().toString() +
        String(yesterday.getMonth() + 1).padStart(2, '0') +
        String(yesterday.getDate()).padStart(2, '0');

      const deviceId = this.getDeviceId();
      return await this.api.getDeviceRecordsForDate(deviceId, yesterdayStr);
    } catch (error) {
      this.error('Failed to fetch yesterday records:', error);
      return [];
    }
  }

  /**
   * Deduplicate records by timestamp
   */
  private deduplicateRecords(records: DeviceRecord[]): DeviceRecord[] {
    const seen = new Set<number>();
    return records.filter(record => {
      const timestamp = record.timestamp || 0;
      if (seen.has(timestamp)) {
        return false;
      }
      seen.add(timestamp);
      return true;
    });
  }

  /**
   * Recursively flatten records including all nested subContent records
   */
  private flattenRecords(records: DeviceRecord[]): DeviceRecord[] {
    const result: DeviceRecord[] = [];

    for (const record of records) {
      result.push(record);

      // Recursively process subContent if present
      if (record.subContent && record.subContent.length > 0) {
        result.push(...this.flattenRecords(record.subContent));
      }
    }

    return result;
  }

  /**
   * Trigger appropriate flow based on record event type
   */
  private async triggerRecordEvent(record: DeviceRecord): Promise<void> {
    switch (record.enumEventType) {
      case 'pet_out': {
        const content = record.content as PetOutContent | undefined;
        this.log('Triggering pet_out flow for:', record.petName || 'Unknown');
        await this.homey.flow
          .getDeviceTriggerCard('litter_pet_out')
          .trigger(this, {
            pet_name: record.petName || 'Unknown',
            pet_weight: content?.petWeight || 0,
            duration: record.duration || 0,
            time_in: content?.timeIn ? this.formatTime(content.timeIn) : '',
            time_out: content?.timeOut ? this.formatTime(content.timeOut) : '',
          });
        break;
      }

      case 'clean_over': {
        const content = record.content as CleanOverContent | undefined;
        this.log('Triggering clean_over flow');
        await this.homey.flow
          .getDeviceTriggerCard('litter_clean_over')
          .trigger(this, {
            litter_percent: content?.litterPercent || 0,
            waste_level: content?.box || 0,
            box_full: content?.boxFull || false,
            result: this.getResultString(content?.result),
          });
        break;
      }

      case 'spray_over': {
        const content = record.content as SprayOverContent | undefined;
        this.log('Triggering spray_over flow');
        await this.homey.flow
          .getDeviceTriggerCard('litter_spray_over')
          .trigger(this, {
            liquid_level: content?.liquid || 0,
            liquid_empty: content?.liquidLack || false,
            result: this.getResultString(content?.result),
          });
        break;
      }

      default:
        // Ignore other event types
        break;
    }
  }

  /**
   * Convert result code to human-readable string
   */
  private getResultString(result: number | undefined): string {
    switch (result) {
      case 0: return 'success';
      case 1: return 'interrupted';
      case 2: return 'failed';
      default: return 'unknown';
    }
  }

  /**
   * Format Unix timestamp to time string
   */
  private formatTime(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleTimeString();
  }
}

export default BaseLitterBoxDevice;

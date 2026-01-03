# Homey App Development Guide for Claude Code (SDK v3)

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [SDK v3 Core Concepts](#sdk-v3-core-concepts)
6. [App Manifest](#app-manifest)
7. [App Class (app.ts)](#app-class-appts)
8. [Drivers and Devices](#drivers-and-devices)
9. [Capabilities](#capabilities)
10. [Pairing](#pairing)
11. [Flow Cards](#flow-cards)
12. [Settings](#settings)
13. [Homey Compose](#homey-compose)
14. [Web API](#web-api)
15. [TypeScript](#typescript)
16. [Using ESM](#using-esm)
17. [Best Practices](#best-practices)
18. [CLI Commands](#cli-commands)

---

## Introduction

Homey is a smart home platform that connects devices from various brands and technologies in one unified experience. The **Homey Apps SDK v3** enables developers to create apps that run on Homey as Node.js bundles.

**This guide focuses exclusively on SDK v3** (Homey >=5.0.0).

### What You Can Build
- Device integrations (drivers for smart home devices)
- Flow cards (triggers, conditions, actions for automation)
- Wireless protocol support (Wi-Fi, Zigbee, Z-Wave, 433 MHz, Bluetooth LE, Infrared, Matter)
- Cloud integrations with OAuth2
- Custom settings pages and Web APIs

### Key Resources
- **SDK v3 Documentation**: https://apps.developer.homey.app
- **SDK v3 API Reference**: https://apps-sdk-v3.developer.homey.app
- **Issue Tracker**: https://github.com/athombv/homey-apps-sdk-issues/issues
- **Community**: https://stackoverflow.com (use `homey` tag)

---

## Prerequisites

### Required Software

1. **Node.js v22 or higher**
   ```bash
   # Download from https://nodejs.org/

   # Or install with NVM (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 22
   nvm use 22
   ```

2. **Docker** (for Homey Cloud and Homey Pro Early 2023)
   - Download from: https://docs.docker.com/desktop/

3. **Homey CLI**
   ```bash
   npm install --global --no-optional homey
   ```

4. **Optional: TypeScript Types**
   ```bash
   npm install @types/homey@npm:homey-apps-sdk-v3-types --save-dev
   ```

### Network Requirements
Your Homey must be either:
- Connected via USB to your development machine, or
- Connected to the same Wi-Fi network as your development machine

---

## Getting Started

### 1. Create Your First Homey App

```bash
homey app create
```

**You'll be prompted for:**
- **App ID** (use reverse domain notation, e.g., `org.acme.mydevice`)
- **App name**
- **Description**
- **Category**

**App ID Rules:**
- Must use reverse domain name notation
- Example: For https://mydevice.acme.org → `org.acme.mydevice`
- Cannot contain "Homey" or "Athom"

### 2. Navigate to App Directory

```bash
cd org.acme.mydevice
```

### 3. Run Your App

```bash
# Start app in development mode
homey app run

# First-time setup:
# 1. Browser will open for Athom account login
# 2. Select target Homey from list
# 3. App uploads and runs automatically
```

**Stop the app:** Press `CTRL + C`

### 4. Verify It Works

After running, your app should appear in the Homey mobile app under **Settings → Apps**.

---

## Project Structure

### Complete Directory Structure

```
com.athom.example/
├─ .homeycompose/               # Compose files (source of truth)
│  ├─ app.json                  # Base app manifest
│  ├─ capabilities/             # Custom capabilities
│  │  └─ my_capability.json
│  ├─ flow/                     # App-level flow cards
│  │  ├─ triggers/
│  │  │  └─ my_trigger.json
│  │  ├─ conditions/
│  │  │  └─ my_condition.json
│  │  └─ actions/
│  │     └─ my_action.json
│  ├─ drivers/                  
│  │  ├─ templates/             # Shared driver properties
│  │  │  └─ defaults.json
│  │  ├─ settings/              # Shared driver settings
│  │  │  └─ common_setting.json
│  │  └─ flow/                  # Shared driver flow cards
│  │     ├─ triggers/
│  │     ├─ conditions/
│  │     └─ actions/
│  └─ locales/                  # Translations
│     ├─ en.json
│     └─ nl.json
├─ assets/                      # App-level assets
│  ├─ icon.svg                  # App icon (REQUIRED, 500x500px)
│  └─ images/                   # App Store images
│     ├─ small.png              # 250x175px (REQUIRED)
│     ├─ large.png              # 500x350px (REQUIRED)
│     └─ xlarge.png             # 1000x700px (optional)
├─ drivers/                     # Driver implementations
│  └─ my_driver/
│     ├─ assets/
│     │  ├─ icon.svg            # Driver icon (REQUIRED)
│     │  └─ images/
│     │     ├─ small.png        # 75x75px
│     │     ├─ large.png        # 500x500px
│     │     └─ xlarge.png       # 1000x1000px
│     ├─ device.ts              # Device class implementation
│     ├─ driver.ts              # Driver class implementation
│     ├─ driver.compose.json    # Driver manifest
│     ├─ driver.settings.compose.json  # Device settings (optional)
│     └─ driver.flow.compose.json      # Driver flow cards (optional)
├─ locales/                     # Main locale files
│  ├─ en.json
│  └─ nl.json
├─ settings/                    # App settings page (optional)
│  └─ index.html
├─ api.ts                       # Web API endpoints (optional)
├─ app.ts                       # Main App class
├─ app.json                     # GENERATED - DO NOT EDIT!
├─ env.json                     # Environment variables (add to .gitignore!)
├─ README.txt                   # App Store description
└─ package.json                 # npm dependencies
```

### Key Files Overview

| File | Purpose | Edit Manually? |
|------|---------|----------------|
| `app.ts` | Main App class | ✅ Yes |
| `app.json` | Complete manifest | ❌ No (generated) |
| `.homeycompose/app.json` | Base manifest | ✅ Yes |
| `env.json` | Secrets & keys | ✅ Yes (don't commit!) |
| `README.txt` | App Store description | ✅ Yes |
| `drivers/*/driver.ts` | Driver logic | ✅ Yes |
| `drivers/*/device.ts` | Device logic | ✅ Yes |
| `drivers/*/driver.compose.json` | Driver manifest | ✅ Yes |

---

## SDK v3 Core Concepts

### Major Changes from SDK v2

#### 1. Managers Access Pattern

**SDK v2 (deprecated):**
```typescript
import Homey from 'homey';
Homey.ManagerFlow.getCard('trigger', 'my_trigger'); // ❌ Old way
```

**SDK v3 (correct):**
```typescript
import Homey from 'homey';

class App extends Homey.App {
  async onInit(): Promise<void> {
    // Access managers through this.homey
    const card = this.homey.flow.getCard('trigger', 'my_trigger');
  }
}
```

**Key Rule:** All managers are accessed via `this.homey` in your App, Driver, and Device classes.

#### 2. Available via `import`

**SDK v3 only exports:**
- `Homey.App` - App class
- `Homey.Driver` - Driver class
- `Homey.Device` - Device class
- `Homey.env` - Environment variables
- `Homey.manifest` - App manifest

**Everything else is accessed via `this.homey`:**
```typescript
this.homey.flow       // ManagerFlow
this.homey.drivers    // ManagerDrivers
this.homey.api        // ManagerApi
this.homey.geolocation // ManagerGeolocation
this.homey.clock      // ManagerClock
this.homey.i18n       // ManagerI18n
// ... and more
```

#### 3. No More Callbacks

All methods in SDK v3 use **Promises/async-await only**. Callbacks are no longer supported.

**SDK v2:**
```typescript
onPair(socket: any): void {
  socket.on('my_event', (data: unknown, callback: Function) => {  // ❌ Old
    callback(null, 'response');
  });
}
```

**SDK v3:**
```typescript
onPair(session: Homey.Driver.PairSession): void {
  session.setHandler('my_event', async (data: unknown) => {  // ✅ New
    return 'response';
  });
}
```

#### 4. onInit() Execution Order

**SDK v3 execution order:**
1. `App#onInit()`
2. `Driver#onInit()` (all drivers)
3. `Device#onInit()` (all devices)

This allows your App to initialize shared resources before drivers/devices need them.

#### 5. Timezone Always UTC

In SDK v3, `process.env.TZ` is always `UTC`. This provides consistent behavior regardless of user timezone settings.

```typescript
// All dates default to UTC
new Date();  // Always in UTC
Date.now();  // Timestamp is timezone-agnostic
```

#### 6. onSettings() Signature Change

**SDK v2:**
```typescript
onSettings(oldSettings: object, newSettings: object, changedKeys: string[], callback: Function) { }  // ❌
```

**SDK v3:**
```typescript
async onSettings({ oldSettings, newSettings, changedKeys }: {
  oldSettings: object;
  newSettings: object;
  changedKeys: string[];
}): Promise<void> { }  // ✅
```

---

## App Manifest

The `app.json` file contains all metadata about your app. **DO NOT edit `app.json` directly**. Instead, use Homey Compose files in `.homeycompose/`.

### Basic Manifest (`.homeycompose/app.json`)

```json
{
  "id": "com.athom.example",
  "version": "1.0.0",
  "compatibility": ">=5.0.0",
  "sdk": 3,
  "platforms": ["local", "cloud"],
  "name": {
    "en": "Example App",
    "nl": "Voorbeeld App"
  },
  "description": {
    "en": "Control your example devices",
    "nl": "Bedien je voorbeeld apparaten"
  },
  "category": "appliances",
  "tags": {
    "en": ["smart home", "automation"],
    "nl": ["smart home", "automatisering"]
  },
  "permissions": [],
  "images": {
    "small": "/assets/images/small.png",
    "large": "/assets/images/large.png",
    "xlarge": "/assets/images/xlarge.png"
  },
  "author": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "contributors": {
    "developers": [
      {
        "name": "Jane Developer"
      }
    ]
  },
  "support": "mailto:support@example.com",
  "homeyCommunityTopicId": 12345,
  "source": "https://github.com/username/repo",
  "bugs": {
    "url": "https://github.com/username/repo/issues"
  }
}
```

### Manifest Properties Reference

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✅ | Reverse domain notation |
| `version` | string | ✅ | Semantic version (e.g., "1.0.0") |
| `compatibility` | string | ✅ | Minimum Homey version (e.g., ">=5.0.0") |
| `sdk` | number | ✅ | Always `3` for SDK v3 |
| `platforms` | array | ❌ | `["local"]` or `["local", "cloud"]` |
| `name` | object | ✅ | Translated app names |
| `description` | object | ✅ | Translated descriptions |
| `category` | string | ✅ | App category (see below) |
| `permissions` | array | ❌ | Required permissions |
| `images` | object | ✅ | App Store images |
| `author` | object | ✅ | Developer info |
| `support` | string | ❌ | Support URL or email |

### Categories

Valid categories:
- `appliances`
- `climate`
- `energy`
- `lights`
- `music`
- `security`
- `tools`
- `video`

### Permissions

Common permissions:
```json
{
  "permissions": [
    "homey:manager:speech-output",
    "homey:manager:speech-input",
    "homey:manager:ledring",
    "homey:manager:geolocation",
    "homey:wireless:ble",
    "homey:wireless:rf",
    "homey:wireless:nfc",
    "homey:wireless:infrared",
    "homey:wireless:433",
    "homey:wireless:868",
    "homey:wireless:zwave",
    "homey:wireless:zigbee"
  ]
}
```

---

## App Class (app.ts)

The App class is instantiated once when your app starts. Use it for shared resources and app-level Flow cards.

### Basic App Structure

```typescript
import Homey from 'homey';

interface SharedData {
  lastUpdate: Date | null;
  cache: Record<string, unknown>;
  someValue: number;
}

class MyApp extends Homey.App {
  private api!: MyAPIClient;
  private sharedData!: SharedData;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit(): Promise<void> {
    this.log('MyApp has been initialized');

    // Initialize shared resources
    await this._initializeSharedResources();

    // Register app-level Flow cards
    await this._registerFlowCards();

    // Register system events
    this._registerSystemEvents();
  }

  private async _initializeSharedResources(): Promise<void> {
    // Example: Initialize API client
    this.api = new MyAPIClient({
      clientId: Homey.env.CLIENT_ID,
      clientSecret: Homey.env.CLIENT_SECRET
    });

    // Example: Create shared data store
    this.sharedData = {
      lastUpdate: null,
      cache: {},
      someValue: 0
    };
  }

  private async _registerFlowCards(): Promise<void> {
    // Register app-level trigger
    const myTrigger = this.homey.flow.getTriggerCard('my_trigger');

    // Register app-level action
    const myAction = this.homey.flow.getActionCard('my_action');
    myAction.registerRunListener(async (args: Record<string, unknown>) => {
      this.log('Action triggered:', args);
      // Perform action
      return true;
    });

    // Register app-level condition
    const myCondition = this.homey.flow.getConditionCard('my_condition');
    myCondition.registerRunListener(async () => {
      // Return true/false
      return this.sharedData.someValue > 10;
    });
  }

  private _registerSystemEvents(): void {
    // Memory warning event
    this.homey.on('memwarn', () => {
      this.log('Memory warning! Cleaning up...');
      this.sharedData.cache = {};
    });

    // CPU warning event
    this.homey.on('cpuwarn', () => {
      this.log('CPU warning!');
    });

    // App unload event
    this.homey.on('unload', () => {
      this.log('App is being unloaded');
    });
  }

  // Public method accessible from drivers/devices
  public getAPIClient(): MyAPIClient {
    return this.api;
  }

  // Trigger app-level flow
  public async triggerSomething(tokens: Record<string, unknown>, state: Record<string, unknown>): Promise<void> {
    const myTrigger = this.homey.flow.getTriggerCard('my_trigger');
    await myTrigger.trigger(tokens, state);
  }
}

module.exports = MyApp;
```

### Accessing App from Driver/Device

```typescript
// In driver.ts or device.ts
const api = this.homey.app.getAPIClient();
```

### Accessing Managers

```typescript
// In App, Driver, or Device classes
this.homey.flow          // ManagerFlow
this.homey.drivers       // ManagerDrivers
this.homey.api           // ManagerApi
this.homey.geolocation   // ManagerGeolocation
this.homey.i18n          // ManagerI18n
this.homey.clock         // ManagerClock
this.homey.insights      // ManagerInsights
this.homey.ledring       // ManagerLedring
this.homey.notifications // ManagerNotifications
this.homey.speechInput   // ManagerSpeechInput
this.homey.speechOutput  // ManagerSpeechOutput
```

---

## Drivers and Devices

### Driver Overview

The **Driver** class manages all devices of a specific type. One driver instance exists per driver, instantiated at app start.

### Device Overview

The **Device** class represents one paired device. One instance exists per paired device.

### Creating a Driver

```bash
# Interactive driver creation
homey app driver create

# Manually: Create driver directory
mkdir -p drivers/my_driver/assets/images
```

### Driver Structure

```
drivers/my_driver/
├─ assets/
│  ├─ icon.svg                     # Driver icon (required)
│  └─ images/
│     ├─ small.png                 # 75x75px
│     ├─ large.png                 # 500x500px
│     └─ xlarge.png                # 1000x1000px
├─ device.ts                       # Device class
├─ driver.ts                       # Driver class
├─ driver.compose.json             # Driver manifest
├─ driver.settings.compose.json    # Device settings (optional)
└─ driver.flow.compose.json        # Device flow cards (optional)
```

### Driver Manifest (`driver.compose.json`)

```json
{
  "name": {
    "en": "My Device"
  },
  "class": "socket",
  "capabilities": [
    "onoff",
    "measure_power",
    "meter_power"
  ],
  "capabilitiesOptions": {
    "measure_power": {
      "title": {
        "en": "Current Power"
      },
      "decimals": 1
    }
  },
  "platforms": ["local", "cloud"],
  "connectivity": ["lan", "cloud"],
  "images": {
    "small": "{{driverAssetsPath}}/images/small.png",
    "large": "{{driverAssetsPath}}/images/large.png",
    "xlarge": "{{driverAssetsPath}}/images/xlarge.png"
  },
  "pair": [
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_devices"
      }
    },
    {
      "id": "add_devices",
      "template": "add_devices"
    }
  ]
}
```

### Driver Class (`driver.ts`)

```typescript
import Homey from 'homey';

interface DiscoveredDevice {
  name: string;
  id: string;
  ip: string;
  key: string;
}

interface PairDevice {
  name: string;
  data: { id: string };
  settings: { ipAddress: string };
  store: { apiKey: string };
}

class MyDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit(): Promise<void> {
    this.log('MyDriver has been initialized');

    // Register driver-level flow cards
    this._registerFlowCards();
  }

  private _registerFlowCards(): void {
    // Register device trigger card
    this.homey.flow.getDeviceTriggerCard('device_triggered');

    // Register device action card
    const actionCard = this.homey.flow.getDeviceActionCard('device_action');
    actionCard.registerRunListener(async (args: { device: Homey.Device; value: unknown }) => {
      const device = args.device as MyDevice;
      await device.performAction(args.value);
      return true;
    });
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with available devices/pairings.
   */
  async onPairListDevices(): Promise<PairDevice[]> {
    this.log('Listing devices...');

    // Example: Discover devices on network
    const discoveredDevices = await this.discoverDevices();

    return discoveredDevices.map((device) => ({
      name: device.name,
      data: {
        id: device.id  // Unique identifier
      },
      settings: {
        ipAddress: device.ip
      },
      store: {
        apiKey: device.key
      }
    }));
  }

  private async discoverDevices(): Promise<DiscoveredDevice[]> {
    // Implementation for device discovery
    return [
      { name: 'Device 1', id: 'device1', ip: '192.168.1.100', key: 'abc123' },
      { name: 'Device 2', id: 'device2', ip: '192.168.1.101', key: 'def456' }
    ];
  }

  /**
   * onPair is called when a user starts pairing.
   * Use this for custom pairing flows.
   */
  onPair(session: Homey.Driver.PairSession): void {
    this.log('Pairing session started');

    session.setHandler('my_custom_event', async (data: unknown) => {
      this.log('Custom pairing event:', data);
      // Process pairing data
      return { success: true };
    });

    session.setHandler('list_devices', async () => {
      return await this.onPairListDevices();
    });
  }

  /**
   * onRepair is called when a user starts repairing a device.
   */
  onRepair(session: Homey.Driver.PairSession, device: Homey.Device): void {
    this.log('Repair session started for:', device.getName());

    session.setHandler('repair_done', async (data: { newIpAddress: string }) => {
      // Update device settings
      await device.setSettings({
        ipAddress: data.newIpAddress
      });
      return true;
    });
  }

  /**
   * onMapDeviceClass is called before onInit of a device.
   * Return a custom Device class based on device data.
   */
  onMapDeviceClass(device: Homey.Device): typeof Homey.Device {
    // Example: Return different class based on capability
    if (device.hasCapability('dim')) {
      return MyDimmableDevice;
    }
    return MyDevice;
  }
}

module.exports = MyDriver;
```

### Device Class (`device.ts`)

```typescript
import Homey from 'homey';

interface DeviceData {
  id: string;
}

interface DeviceSettings {
  ipAddress: string;
}

interface DeviceState {
  power: boolean;
  currentPower: number;
}

class MyDevice extends Homey.Device {
  private pollingInterval: NodeJS.Timeout | null = null;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit(): Promise<void> {
    this.log('MyDevice has been initialized');
    this.log('Name:', this.getName());
    this.log('Class:', this.getClass());

    // Get device data, settings, store
    const data = this.getData() as DeviceData;
    const settings = this.getSettings() as DeviceSettings;
    const store = this.getStore();

    this.log('Device ID:', data.id);
    this.log('IP Address:', settings.ipAddress);

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('measure_power', this.onCapabilityMeasurePower.bind(this));

    // Start polling device
    this.startPolling();
  }

  /**
   * onAdded is called when the user adds the device,
   * called just after pairing.
   */
  async onAdded(): Promise<void> {
    this.log('MyDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   */
  async onSettings({ oldSettings, newSettings, changedKeys }: {
    oldSettings: DeviceSettings;
    newSettings: DeviceSettings;
    changedKeys: string[];
  }): Promise<void> {
    this.log('MyDevice settings were changed');
    this.log('Changed keys:', changedKeys);
    this.log('New IP:', newSettings.ipAddress);

    // Reconnect to device with new settings
    if (changedKeys.includes('ipAddress')) {
      await this.reconnect(newSettings.ipAddress);
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   */
  async onRenamed(name: string): Promise<void> {
    this.log('MyDevice was renamed to:', name);
  }

  /**
   * onDeleted is called when the user deletes the device.
   */
  async onDeleted(): Promise<void> {
    this.log('MyDevice has been deleted');
    this.stopPolling();
  }

  // --- Capability Listeners ---

  private async onCapabilityOnoff(value: boolean): Promise<boolean> {
    this.log('onoff changed to:', value);

    // Send command to device
    const settings = this.getSettings() as DeviceSettings;
    await this.sendCommand(settings.ipAddress, 'power', value);

    // Update capability value if needed
    // await this.setCapabilityValue('onoff', value);

    return value;
  }

  private async onCapabilityMeasurePower(value: number): Promise<void> {
    this.log('measure_power changed to:', value);
    // Usually measure_* capabilities are read-only
    // and updated by polling
  }

  // --- Custom Methods ---

  private startPolling(): void {
    this.pollingInterval = this.homey.setInterval(async () => {
      await this.pollDevice();
    }, 10000); // Poll every 10 seconds
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      this.homey.clearInterval(this.pollingInterval);
    }
  }

  private async pollDevice(): Promise<void> {
    try {
      const settings = this.getSettings() as DeviceSettings;
      const state = await this.fetchDeviceState(settings.ipAddress);

      // Update capability values
      await this.setCapabilityValue('onoff', state.power);
      await this.setCapabilityValue('measure_power', state.currentPower);

    } catch (error) {
      this.error('Polling error:', error);
      await this.setUnavailable('Device unreachable');
    }
  }

  private async sendCommand(ip: string, command: string, value: unknown): Promise<void> {
    // Implementation to send command to device
    this.log(`Sending ${command}=${value} to ${ip}`);
  }

  private async fetchDeviceState(ip: string): Promise<DeviceState> {
    // Implementation to fetch device state
    return {
      power: true,
      currentPower: 150
    };
  }

  private async reconnect(newIp: string): Promise<void> {
    this.log('Reconnecting to:', newIp);
    // Reconnection logic
  }

  public async performAction(value: unknown): Promise<void> {
    this.log('Performing action:', value);
    // Custom action logic
  }
}

module.exports = MyDevice;
```

### Device Data, Settings, and Store

```typescript
// Device Data (immutable identifier)
const data = this.getData() as { id: string };
// { id: 'unique-device-id' }
// Used to identify the device - should never change

// Settings (user-configurable)
const settings = this.getSettings() as { ipAddress: string; refreshInterval: number };
// { ipAddress: '192.168.1.100', refreshInterval: 30 }
await this.setSettings({ ipAddress: '192.168.1.101' });

// Store (persistent app data)
const store = this.getStore();
const apiKey = this.getStoreValue('apiKey') as string;
await this.setStoreValue('lastSync', Date.now());
```

### Device Classes Reference

Common device classes:
- `light` - Lighting devices
- `socket` - Power sockets/plugs
- `thermostat` - Climate control
- `lock` - Door locks
- `sensor` - Sensors
- `doorbell` - Doorbells
- `speaker` - Audio devices
- `tv` - Television devices
- `fan` - Fans
- `heater` - Heating devices
- `kettle` - Kettles
- `curtain` - Window coverings
- `vacuumcleaner` - Vacuum cleaners
- `other` - Everything else

See full list: https://apps-sdk-v3.developer.homey.app/tutorial-device-classes.html

---

## Capabilities

Capabilities represent device states and actions.

### Using System Capabilities

```json
{
  "capabilities": [
    "onoff",
    "dim",
    "measure_temperature",
    "target_temperature",
    "alarm_motion"
  ]
}
```

### Common System Capabilities

| Capability | Type | Description |
|-----------|------|-------------|
| `onoff` | boolean | Power on/off |
| `dim` | number (0-1) | Brightness |
| `measure_temperature` | number | Current temperature |
| `target_temperature` | number | Target temperature |
| `measure_power` | number | Current power (W) |
| `meter_power` | number | Total energy (kWh) |
| `alarm_motion` | boolean | Motion detected |
| `alarm_contact` | boolean | Contact sensor |
| `volume_set` | number (0-1) | Volume level |
| `speaker_playing` | boolean | Playing state |

See full list: https://apps-sdk-v3.developer.homey.app/tutorial-device-capabilities.html

### Capability Options

```json
{
  "capabilitiesOptions": {
    "measure_temperature": {
      "title": {
        "en": "Room Temperature"
      },
      "decimals": 1,
      "units": {
        "en": "°C"
      },
      "min": -20,
      "max": 50
    },
    "dim": {
      "duration": true
    }
  }
}
```

### Sub-Capabilities

Use sub-capabilities for multiple instances:

```json
{
  "capabilities": [
    "measure_temperature.inside",
    "measure_temperature.outside"
  ],
  "capabilitiesOptions": {
    "measure_temperature.inside": {
      "title": {
        "en": "Inside Temperature"
      }
    },
    "measure_temperature.outside": {
      "title": {
        "en": "Outside Temperature"
      }
    }
  }
}
```

### Custom Capabilities

Create in `.homeycompose/capabilities/my_capability.json`:

```json
{
  "type": "number",
  "title": {
    "en": "Humidity"
  },
  "units": {
    "en": "%"
  },
  "decimals": 0,
  "min": 0,
  "max": 100,
  "getable": true,
  "setable": false,
  "uiComponent": "sensor",
  "icon": "/assets/humidity.svg"
}
```

Use in driver:

```json
{
  "capabilities": [
    "my_capability"
  ]
}
```

### Managing Capabilities in Code

```typescript
// Get capability value
const isOn = await this.getCapabilityValue('onoff') as boolean;

// Set capability value (from device to Homey)
await this.setCapabilityValue('onoff', true);
await this.setCapabilityValue('measure_temperature', 22.5);

// Register capability listener (from Homey to device)
this.registerCapabilityListener('onoff', async (value: boolean) => {
  // Send command to device
  await this.device.setPower(value);
  return value;
});

// Add capability dynamically
if (!this.hasCapability('dim')) {
  await this.addCapability('dim');
}

// Remove capability dynamically
if (this.hasCapability('old_capability')) {
  await this.removeCapability('old_capability');
}

// Check if capability exists
if (this.hasCapability('dim')) {
  // ...
}
```

---

## Pairing

Pairing is the process of adding a device to Homey.

### Simple Pairing (List Devices)

Use `onPairListDevices()` for simple pairing:

```typescript
// driver.ts
interface DiscoveredDevice {
  name: string;
  id: string;
  ip: string;
  apiKey: string;
  model: string;
}

async onPairListDevices(): Promise<Homey.Device.DeviceObject[]> {
  const devices = await this.discoverDevices();

  return devices.map((device: DiscoveredDevice) => ({
    name: device.name,
    data: {
      id: device.id  // Unique, immutable identifier
    },
    settings: {
      // User-changeable settings
      ipAddress: device.ip,
      refreshInterval: 30
    },
    store: {
      // Private app data
      apiKey: device.apiKey,
      modelNumber: device.model
    },
    capabilities: ['onoff', 'dim'],  // Override driver capabilities
    capabilitiesOptions: {
      dim: {
        min: 0.1,
        max: 1
      }
    }
  }));
}
```

### System Pairing Templates

Define in `driver.compose.json`:

```json
{
  "pair": [
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_devices"
      }
    },
    {
      "id": "add_devices",
      "template": "add_devices"
    }
  ]
}
```

**Available templates:**
- `list_devices` - Show list of discovered devices
- `add_devices` - Confirm device addition
- `oauth2_login` - OAuth2 authentication
- `login_credentials` - Username/password login
- `pincode` - Enter PIN code
- `loading` - Loading screen
- `done` - Success screen

### Custom Pairing Flow

```typescript
// driver.ts
onPair(session: Homey.Driver.PairSession): void {
  let username = '';
  let password = '';

  session.setHandler('login', async (data: { username: string; password: string }) => {
    username = data.username;
    password = data.password;

    // Validate credentials
    const isValid = await this.validateCredentials(username, password);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    return true;
  });

  session.setHandler('list_devices', async () => {
    // Use stored credentials to list devices
    const devices = await this.getDevicesForUser(username, password);

    return devices.map((device) => ({
      name: device.name,
      data: {
        id: device.id
      },
      settings: {
        username: username
      },
      store: {
        apiToken: device.token
      }
    }));
  });
}
```

Custom pairing view (`.homeycompose/` or `drivers/*/pair/`):

```json
{
  "pair": [
    {
      "id": "login",
      "template": "login_credentials"
    },
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_devices"
      }
    },
    {
      "id": "add_devices",
      "template": "add_devices"
    }
  ]
}
```

### Repairing Devices

```json
{
  "repair": [
    {
      "id": "login_oauth2",
      "template": "login_oauth2"
    }
  ]
}
```

```typescript
// driver.ts
onRepair(session: Homey.Driver.PairSession, device: Homey.Device): void {
  this.log('Repairing device:', device.getName());

  session.setHandler('repair_credentials', async (data: {
    username: string;
    password: string;
    token: string;
  }) => {
    await device.setSettings({
      username: data.username,
      password: data.password
    });

    await device.setStoreValue('apiToken', data.token);

    return true;
  });
}
```

---

## Flow Cards

Flow cards enable automation. There are three types:
- **Triggers** ("When...") - Fire when something happens
- **Conditions** ("And...") - Check if something is true
- **Actions** ("Then...") - Perform an action

### App-Level Flow Cards

Define in `.homeycompose/flow/triggers/my_trigger.json`:

```json
{
  "title": {
    "en": "Something happened"
  },
  "hint": {
    "en": "This card triggers when something happens"
  },
  "tokens": [
    {
      "name": "value",
      "type": "number",
      "title": {
        "en": "Value"
      },
      "example": 25
    }
  ]
}
```

Register in `app.ts`:

```typescript
async onInit(): Promise<void> {
  const myTrigger = this.homey.flow.getTriggerCard('my_trigger');

  // Trigger it somewhere in your code
  await myTrigger.trigger({ value: 42 });
}
```

### Action Card

`.homeycompose/flow/actions/my_action.json`:

```json
{
  "title": {
    "en": "Do something"
  },
  "titleFormatted": {
    "en": "Do something with [[value]]"
  },
  "hint": {
    "en": "This performs an action"
  },
  "args": [
    {
      "type": "number",
      "name": "value",
      "title": {
        "en": "Value"
      },
      "min": 0,
      "max": 100,
      "step": 1,
      "placeholder": {
        "en": "50"
      }
    }
  ]
}
```

Register in `app.ts`:

```typescript
const myAction = this.homey.flow.getActionCard('my_action');
myAction.registerRunListener(async (args: { value: number }) => {
  this.log('Action triggered with value:', args.value);

  // Perform action
  await this.doSomething(args.value);

  return true;  // Action successful
});
```

### Condition Card

`.homeycompose/flow/conditions/my_condition.json`:

```json
{
  "title": {
    "en": "Something !{{is|isn't}} true"
  },
  "titleFormatted": {
    "en": "Value !{{is|isn't}} greater than [[threshold]]"
  },
  "args": [
    {
      "type": "number",
      "name": "threshold",
      "title": {
        "en": "Threshold"
      }
    }
  ]
}
```

Register in `app.ts`:

```typescript
const myCondition = this.homey.flow.getConditionCard('my_condition');
myCondition.registerRunListener(async (args: { threshold: number }) => {
  const currentValue = await this.getCurrentValue();
  return currentValue > args.threshold;  // true = continue, false = stop
});
```

### Device Flow Cards

Define in `drivers/my_driver/driver.flow.compose.json`:

```json
{
  "triggers": [
    {
      "id": "button_pressed",
      "title": {
        "en": "Button pressed"
      },
      "args": [
        {
          "name": "device",
          "type": "device",
          "filter": "driver_id=my_driver"
        },
        {
          "name": "button",
          "type": "dropdown",
          "values": [
            { "id": "1", "label": { "en": "Button 1" } },
            { "id": "2", "label": { "en": "Button 2" } }
          ]
        }
      ],
      "tokens": [
        {
          "name": "press_count",
          "type": "number",
          "title": { "en": "Press count" }
        }
      ]
    }
  ],
  "actions": [
    {
      "id": "activate_mode",
      "title": {
        "en": "Activate mode"
      },
      "titleFormatted": {
        "en": "Activate [[mode]]"
      },
      "args": [
        {
          "name": "device",
          "type": "device",
          "filter": "driver_id=my_driver"
        },
        {
          "name": "mode",
          "type": "dropdown",
          "values": [
            { "id": "normal", "label": { "en": "Normal" } },
            { "id": "eco", "label": { "en": "Eco" } }
          ]
        }
      ]
    }
  ]
}
```

Register in `driver.ts`:

```typescript
async onInit(): Promise<void> {
  // Register device trigger
  this.buttonPressedTrigger = this.homey.flow.getDeviceTriggerCard('button_pressed');

  // Register device action
  const activateModeAction = this.homey.flow.getDeviceActionCard('activate_mode');
  activateModeAction.registerRunListener(async (args: { device: Homey.Device; mode: { id: string } }) => {
    const device = args.device as MyDevice;
    await device.activateMode(args.mode.id);
    return true;
  });
}
```

Trigger from `device.ts`:

```typescript
async onButtonPressed(buttonId: string): Promise<void> {
  const device = this;
  const driver = this.getDriver() as MyDriver;

  await driver.buttonPressedTrigger.trigger(device, {
    press_count: this.pressCount
  }, {
    button: buttonId
  });
}
```

### Flow Card Arguments

**Argument types:**
- `text` - Text input
- `number` - Number input
- `dropdown` - Dropdown selection
- `range` - Slider
- `checkbox` - Checkbox
- `date` - Date picker
- `time` - Time picker
- `device` - Device selector
- `autocomplete` - Autocomplete field

**Dropdown example:**

```json
{
  "args": [
    {
      "type": "dropdown",
      "name": "mode",
      "title": { "en": "Mode" },
      "values": [
        { "id": "mode1", "label": { "en": "Mode 1" } },
        { "id": "mode2", "label": { "en": "Mode 2" } }
      ]
    }
  ]
}
```

**Autocomplete example:**

```json
{
  "args": [
    {
      "type": "autocomplete",
      "name": "user",
      "title": { "en": "User" },
      "placeholder": { "en": "Search users..." }
    }
  ]
}
```

Register autocomplete:

```typescript
interface User {
  name: string;
  email: string;
  id: string;
}

const myAction = this.homey.flow.getActionCard('my_action');

myAction.registerArgumentAutocompleteListener('user', async (query: string) => {
  const users = await this.searchUsers(query);
  return users.map((user: User) => ({
    name: user.name,
    description: user.email,
    id: user.id
  }));
});
```

### Duration Support

```json
{
  "title": {
    "en": "Turn on light"
  },
  "duration": true,
  "args": [...]
}
```

```typescript
myAction.registerRunListener(async (args: { duration?: number }) => {
  if (args.duration) {
    this.log('Duration specified:', args.duration, 'ms');
    // Perform action for specified duration
  }
});
```

---

## Settings

### Device Settings

Define in `drivers/my_driver/driver.settings.compose.json`:

```json
[
  {
    "type": "group",
    "label": {
      "en": "General Settings"
    },
    "children": [
      {
        "id": "ipAddress",
        "type": "text",
        "label": {
          "en": "IP Address"
        },
        "value": "192.168.1.100",
        "hint": {
          "en": "Enter the device IP address"
        }
      },
      {
        "id": "refreshInterval",
        "type": "number",
        "label": {
          "en": "Refresh Interval"
        },
        "value": 30,
        "min": 10,
        "max": 300,
        "units": {
          "en": "seconds"
        }
      },
      {
        "id": "enableNotifications",
        "type": "checkbox",
        "label": {
          "en": "Enable notifications"
        },
        "value": true
      },
      {
        "id": "mode",
        "type": "dropdown",
        "label": {
          "en": "Operating Mode"
        },
        "value": "normal",
        "values": [
          { "id": "normal", "label": { "en": "Normal" } },
          { "id": "eco", "label": { "en": "Eco" } },
          { "id": "performance", "label": { "en": "Performance" } }
        ]
      },
      {
        "id": "password",
        "type": "password",
        "label": {
          "en": "Password"
        },
        "value": ""
      }
    ]
  }
]
```

Access settings in `device.ts`:

```typescript
interface DeviceSettings {
  ipAddress: string;
  refreshInterval: number;
  enableNotifications: boolean;
  mode: string;
  password: string;
}

async onInit(): Promise<void> {
  const settings = this.getSettings() as DeviceSettings;
  this.log('IP Address:', settings.ipAddress);
  this.log('Refresh Interval:', settings.refreshInterval);
}

async onSettings({ oldSettings, newSettings, changedKeys }: {
  oldSettings: DeviceSettings;
  newSettings: DeviceSettings;
  changedKeys: string[];
}): Promise<void> {
  this.log('Settings changed:', changedKeys);

  if (changedKeys.includes('ipAddress')) {
    this.log('New IP:', newSettings.ipAddress);
    await this.reconnect(newSettings.ipAddress);
  }

  // Throw error to reject settings
  if (newSettings.refreshInterval < 10) {
    throw new Error('Refresh interval must be at least 10 seconds');
  }
}

// Update settings programmatically
async updateSettings(): Promise<void> {
  await this.setSettings({
    refreshInterval: 60
  });
}
```

### App Settings

Create `settings/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="text/javascript" src="/homey.js"></script>
  <style>
    body {
      font-family: sans-serif;
      padding: 20px;
    }
    label {
      display: block;
      margin: 10px 0 5px 0;
    }
    input {
      width: 100%;
      padding: 5px;
    }
  </style>
</head>
<body>
  <h1>App Settings</h1>
  
  <label for="apiKey">API Key:</label>
  <input type="text" id="apiKey" />
  
  <label for="region">Region:</label>
  <select id="region">
    <option value="us">United States</option>
    <option value="eu">Europe</option>
    <option value="asia">Asia</option>
  </select>
  
  <button id="save">Save</button>
  
  <script>
    function onHomeyReady(Homey) {
      // Load current settings
      Homey.get('apiKey', function(err, apiKey) {
        if (apiKey) document.getElementById('apiKey').value = apiKey;
      });
      
      Homey.get('region', function(err, region) {
        if (region) document.getElementById('region').value = region;
      });
      
      // Save settings
      document.getElementById('save').addEventListener('click', function() {
        const apiKey = document.getElementById('apiKey').value;
        const region = document.getElementById('region').value;
        
        Homey.set('apiKey', apiKey, function(err) {
          if (err) return Homey.alert(err);
        });
        
        Homey.set('region', region, function(err) {
          if (err) return Homey.alert(err);
          Homey.alert('Settings saved!');
        });
      });
      
      Homey.ready();
    }
  </script>
</body>
</html>
```

Access in `app.ts`:

```typescript
async onInit(): Promise<void> {
  const apiKey = this.homey.settings.get('apiKey') as string | null;
  const region = this.homey.settings.get('region') as string | null;

  // Listen for changes
  this.homey.settings.on('set', (key: string) => {
    this.log(`Setting '${key}' was changed`);
    if (key === 'apiKey') {
      this.reinitializeAPI();
    }
  });
}
```

---

## Homey Compose

Homey Compose splits the app manifest into smaller, manageable files.

### Structure Overview

```
.homeycompose/
├─ app.json                    # Base manifest
├─ capabilities/
│  └─ my_capability.json       # Custom capabilities
├─ flow/
│  ├─ triggers/
│  │  └─ my_trigger.json       # App triggers
│  ├─ conditions/
│  │  └─ my_condition.json     # App conditions
│  └─ actions/
│     └─ my_action.json        # App actions
├─ drivers/
│  ├─ templates/
│  │  └─ defaults.json         # Driver templates
│  └─ flow/
│     ├─ triggers/
│     ├─ conditions/
│     └─ actions/
└─ locales/
   └─ en.json                  # Translations
```

### Driver Templates

Create shared properties in `.homeycompose/drivers/templates/defaults.json`:

```json
{
  "images": {
    "small": "{{driverAssetsPath}}/images/small.png",
    "large": "{{driverAssetsPath}}/images/large.png",
    "xlarge": "{{driverAssetsPath}}/images/xlarge.png"
  },
  "icon": "{{driverAssetsPath}}/icon.svg",
  "capabilities": [],
  "platforms": ["local", "cloud"],
  "connectivity": ["lan"]
}
```

Use in `drivers/my_driver/driver.compose.json`:

```json
{
  "$extends": "defaults",
  "name": {
    "en": "My Driver"
  },
  "class": "socket",
  "capabilities": [
    "onoff"
  ]
}
```

### Building the Manifest

```bash
# Compose automatically builds when running:
homey app run
homey app install
homey app validate

# Manually build:
homey app build
```

The `app.json` file is generated from all compose files. **Never edit `app.json` directly!**

---

## Web API

Your app can expose HTTP endpoints for external access.

### Define API Routes

In `.homeycompose/app.json`:

```json
{
  "api": {
    "getStatus": {
      "method": "GET",
      "path": "/status"
    },
    "updateDevice": {
      "method": "PUT",
      "path": "/device/:id"
    },
    "deleteDevice": {
      "method": "DELETE",
      "path": "/device/:id",
      "public": true
    }
  }
}
```

### Implement API Handlers

Create `api.ts`:

```typescript
import Homey from 'homey';

interface APIContext {
  homey: Homey.Homey;
  query: Record<string, string>;
  params: Record<string, string>;
  body: Record<string, unknown>;
}

module.exports = {

  async getStatus({ homey, query }: APIContext) {
    // Access app instance
    const app = homey.app;

    // Access query parameters: ?foo=bar
    const foo = query.foo;

    return {
      status: 'online',
      deviceCount: app.getDeviceCount(),
      foo: foo
    };
  },

  async updateDevice({ homey, params, body }: APIContext) {
    // Access URL parameters: /device/:id
    const deviceId = params.id;

    // Access request body
    const newName = body.name as string;

    // Get device
    const device = await homey.app.getDevice(deviceId);
    await device.setName(newName);

    return {
      success: true,
      device: {
        id: device.getId(),
        name: device.getName()
      }
    };
  },

  async deleteDevice({ homey, params }: APIContext) {
    const deviceId = params.id;

    await homey.app.deleteDevice(deviceId);

    return {
      success: true
    };
  }

};
```

### API Endpoints

Your API is available at:
- Local: `http://<homey-ip>/api/app/com.yourapp.id/`
- Cloud: `https://<homey-cloud-id>.connect.athom.com/api/app/com.yourapp.id/`

**Authentication:** Endpoints require authentication unless marked with `"public": true`.

### Realtime Events

Emit events from your app:

```typescript
// In app.ts or device.ts
await this.homey.api.realtime('device_updated', {
  deviceId: 'device123',
  status: 'online'
});
```

Listen in API client:
```typescript
const api = new HomeyAPI(/* ... */);
api.on('device_updated', (event: { deviceId: string; status: string }) => {
  console.log('Device updated:', event);
});
```

---

## TypeScript

TypeScript adds type safety to Homey app development, helping catch bugs before runtime. The Homey CLI provides seamless TypeScript integration.

### How It Works

TypeScript "transpiles" to JavaScript - the TypeScript you write is converted to JavaScript that runs on Homey. The compiler generates files in a `.homeybuild/` directory, which Homey then bundles into the app.

### Setting Up a New App with TypeScript

When creating a new app, the CLI offers TypeScript setup:

```bash
homey app create
```

Select **'Yes'** when prompted to initialize with TypeScript utilities. The CLI automatically configures:
- `tsconfig.json` with proper settings
- All necessary dependencies
- Source map support

### Converting an Existing JavaScript App

To convert an existing JavaScript app to TypeScript:

#### 1. Create `tsconfig.json`

Add this file to your app's root:

```json
{
  "compilerOptions": {
    "outDir": ".homeybuild/",
    "sourceMap": true,
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": [
    "app.ts",
    "drivers/**/*.ts",
    "lib/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".homeybuild"
  ]
}
```

#### 2. Install Dependencies

```bash
homey app add-types
```

This installs the TypeScript type definitions for the Homey SDK.

#### 3. Update Entry Point

Rename `app.js` to `app.ts` and add source-map support:

```typescript
import Homey from 'homey';
import sourceMapSupport from 'source-map-support';

sourceMapSupport.install();

class MyApp extends Homey.App {
  async onInit() {
    this.log('MyApp has been initialized');
  }
}

module.exports = MyApp;
```

#### 4. Add Build Script

Add to `package.json`:

```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

### TypeScript Project Structure

```
com.athom.example/
├─ .homeybuild/              # GENERATED - compiled JS files
├─ app.ts                    # Main App class (TypeScript)
├─ drivers/
│  └─ my_driver/
│     ├─ device.ts           # Device class (TypeScript)
│     └─ driver.ts           # Driver class (TypeScript)
├─ lib/
│  └─ api-client.ts          # Shared utilities
├─ tsconfig.json             # TypeScript configuration
└─ package.json
```

### Key Features

- **File-by-file conversion** - Migrate gradually; TypeScript and JavaScript files can coexist
- **Driver generation** - When `tsconfig.json` exists, `homey app driver create` generates TypeScript files by default
- **Automatic compilation** - Running, installing, or publishing apps triggers TypeScript compilation automatically

### TypeScript Device Example

```typescript
import Homey from 'homey';

interface DeviceData {
  id: string;
}

interface DeviceSettings {
  ipAddress: string;
  refreshInterval: number;
}

class MyDevice extends Homey.Device {
  private pollingInterval: NodeJS.Timeout | null = null;

  async onInit(): Promise<void> {
    this.log('MyDevice has been initialized');

    const data = this.getData() as DeviceData;
    const settings = this.getSettings() as DeviceSettings;

    this.log('Device ID:', data.id);
    this.log('IP Address:', settings.ipAddress);

    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    this.startPolling(settings.refreshInterval);
  }

  private async onCapabilityOnoff(value: boolean): Promise<boolean> {
    this.log('onoff changed to:', value);
    await this.sendCommand('power', value);
    return value;
  }

  private startPolling(intervalSeconds: number): void {
    this.pollingInterval = this.homey.setInterval(async () => {
      await this.pollDevice();
    }, intervalSeconds * 1000);
  }

  private async pollDevice(): Promise<void> {
    try {
      const state = await this.fetchDeviceState();
      await this.setCapabilityValue('onoff', state.power);
      await this.setAvailable();
    } catch (error) {
      this.error('Polling error:', error);
      await this.setUnavailable('Device unreachable');
    }
  }

  private async sendCommand(command: string, value: unknown): Promise<void> {
    // Implementation
  }

  private async fetchDeviceState(): Promise<{ power: boolean }> {
    // Implementation
    return { power: true };
  }

  async onDeleted(): Promise<void> {
    if (this.pollingInterval) {
      this.homey.clearInterval(this.pollingInterval);
    }
  }
}

module.exports = MyDevice;
```

### Disabling TypeScript

To use JavaScript exclusively, remove or rename `tsconfig.json` to prevent TypeScript compilation.

---

## Using ESM

Since **Homey v12.0.1**, apps can use ECMAScript Modules (ESM) instead of CommonJS. ESM offers improved module isolation and native asynchronous loading support.

### Enabling ESM

The primary way to adopt ESM is by renaming JavaScript files to use the `.mjs` extension. This signals to Node.js that files should be treated as ESM modules.

```
app.js  →  app.mjs
drivers/my_driver/device.js  →  drivers/my_driver/device.mjs
drivers/my_driver/driver.js  →  drivers/my_driver/driver.mjs
```

### Code Conversion

#### CommonJS (old)

```javascript
'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {
  async onInit() {
    this.log('App initialized');
  }
}

module.exports = MyApp;
```

#### ESM (new)

```javascript
import Homey from 'homey';

class MyApp extends Homey.App {
  async onInit() {
    this.log('App initialized');
  }
}

export default MyApp;
```

### Syntax Changes

| CommonJS | ESM |
|----------|-----|
| `const Homey = require('homey');` | `import Homey from 'homey';` |
| `const { App } = require('homey');` | `import { App } from 'homey';` |
| `module.exports = MyClass;` | `export default MyClass;` |
| `module.exports = { func1, func2 };` | `export { func1, func2 };` |
| `exports.myFunc = myFunc;` | `export { myFunc };` |

### Handling `__dirname` and `__filename`

ESM doesn't provide `__dirname` or `__filename` globally. Use this workaround:

```javascript
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Now you can use __dirname and __filename as usual
```

### Dynamic Imports

In ESM, use `import()` for dynamic imports instead of `require()`:

```javascript
// CommonJS dynamic require
const module = require('./lib/' + moduleName);

// ESM dynamic import
const module = await import('./lib/' + moduleName + '.mjs');
```

### ESM App Example

`app.mjs`:

```javascript
import Homey from 'homey';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MyApp extends Homey.App {
  async onInit() {
    this.log('MyApp has been initialized (ESM)');
    this.log('App directory:', __dirname);

    // Top-level await is supported in ESM
    const config = await this.loadConfig();
    this.log('Config loaded:', config);
  }

  async loadConfig() {
    // Dynamic import example
    const configModule = await import('./config.mjs');
    return configModule.default;
  }
}

export default MyApp;
```

`drivers/my_driver/device.mjs`:

```javascript
import Homey from 'homey';

class MyDevice extends Homey.Device {
  async onInit() {
    this.log('MyDevice initialized (ESM)');

    this.registerCapabilityListener('onoff', async (value) => {
      this.log('onoff:', value);
      return value;
    });
  }
}

export default MyDevice;
```

### Requirements

1. **Update app compatibility** in `.homeycompose/app.json`:

```json
{
  "compatibility": ">=12.0.1"
}
```

2. **Verify third-party dependencies** support ESM before migrating

### Important Considerations

- **Incremental migration** - Convert files one at a time; `.mjs` and `.js` (CommonJS) files can coexist
- **Asynchronous loading** - ESM supports asynchronous loading while CommonJS is synchronous; certain patterns may behave differently
- **Strict mode** - ESM runs in strict mode by default
- **Top-level await** - Supported in ESM modules

### Benefits of ESM

- Top-level `await` support
- Strict mode by default
- Better static analysis for development tools
- Alignment with modern JavaScript ecosystem standards
- Native async module loading

---

## Best Practices

### 1. Memory Management

```typescript
// Use homey's setInterval/setTimeout (auto-cleanup)
this.pollingInterval = this.homey.setInterval(() => {
  this.poll();
}, 10000);

// Clear manually if needed
this.homey.clearInterval(this.pollingInterval);

// Listen for memory warnings
this.homey.on('memwarn', () => {
  this.log('Memory warning - cleaning up');
  this.cache = {};
});
```

### 2. Error Handling

```typescript
async onInit(): Promise<void> {
  try {
    await this.initialize();
  } catch (error) {
    this.error('Initialization failed:', error);
    await this.setUnavailable(this.homey.__('errors.init_failed'));
  }
}

// Mark device unavailable
await this.setUnavailable('Connection lost');

// Mark device available again
await this.setAvailable();
```

### 3. Logging

```typescript
// Use built-in logging
this.log('Info message');
this.error('Error message');

// Structured logging
this.log('Device state:', { id: device.id, status: 'online' });
```

### 4. Internationalization

All user-facing strings should be translated.

`locales/en.json`:
```json
{
  "settings": {
    "ip_address": "IP Address",
    "refresh_interval": "Refresh Interval"
  },
  "errors": {
    "connection_failed": "Connection failed",
    "invalid_credentials": "Invalid credentials"
  }
}
```

Use in code:
```typescript
const message = this.homey.__('errors.connection_failed');
throw new Error(message);
```

### 5. Device Availability

```typescript
async pollDevice(): Promise<void> {
  try {
    const state = await this.fetchState();
    await this.setAvailable();
    await this.updateCapabilities(state);
  } catch (error) {
    this.error('Poll failed:', error);
    await this.setUnavailable(this.homey.__('errors.connection_lost'));
  }
}
```

### 6. Capability Updates

```typescript
// Batch updates
await Promise.all([
  this.setCapabilityValue('onoff', true),
  this.setCapabilityValue('measure_power', 150),
  this.setCapabilityValue('measure_temperature', 22.5)
]);

// Only update if changed
const newValue = 23.0;
if (this.getCapabilityValue('measure_temperature') !== newValue) {
  await this.setCapabilityValue('measure_temperature', newValue);
}
```

### 7. Store vs Settings

```typescript
// Settings: User-configurable, visible in UI
await this.setSettings({ ipAddress: '192.168.1.100' });

// Store: App-managed, hidden from user
await this.setStoreValue('apiToken', 'secret123');
await this.setStoreValue('lastSync', Date.now());
```

### 8. Deprecating Features

Mark deprecated drivers/flow cards in manifest:

```json
{
  "drivers": [
    {
      "id": "old_driver",
      "deprecated": true,
      "name": { "en": "Old Driver (Deprecated)" }
    }
  ],
  "flow": {
    "actions": [
      {
        "id": "old_action",
        "deprecated": true,
        "title": { "en": "Old Action" }
      }
    ]
  }
}
```

---

## CLI Commands

### Basic Commands

```bash
# Login/logout
homey login
homey logout

# Select target Homey
homey select

# Create new app
homey app create

# Create new driver
homey app driver create

# Run app (development mode)
homey app run

# Install app (without logs)
homey app install

# Clean install
homey app run --clean

# Validate app
homey app validate

# Build app
homey app build

# Publish to App Store
homey app publish

# Update app version
homey app version [major|minor|patch]

# Open app in App Store
homey app store

# Show help
homey --help
homey app --help
```

### Advanced Commands

```bash
# Run with specific path
homey app run --path=/path/to/app

# Validate before publishing
homey app validate

# Check for updates
homey app version patch

# View CLI documentation
homey app docs
```

---

## Additional Resources

- **Official SDK v3 Guide**: https://apps.developer.homey.app
- **SDK v3 API Reference**: https://apps-sdk-v3.developer.homey.app
- **Device Capabilities**: https://apps-sdk-v3.developer.homey.app/tutorial-device-capabilities.html
- **Device Classes**: https://apps-sdk-v3.developer.homey.app/tutorial-device-classes.html
- **Issue Tracker**: https://github.com/athombv/homey-apps-sdk-issues
- **Community Forum**: https://community.homey.app
- **Stack Overflow**: https://stackoverflow.com (tag: `homey`)
- **App Store Guidelines**: https://apps.developer.homey.app/app-store/guidelines

---

## Quick Reference Card

### Core Classes

```typescript
// App
import Homey from 'homey';
class MyApp extends Homey.App {
  async onInit(): Promise<void> { }
}

// Driver
class MyDriver extends Homey.Driver {
  async onInit(): Promise<void> { }
  async onPairListDevices(): Promise<Homey.Device.DeviceObject[]> { return []; }
}

// Device
class MyDevice extends Homey.Device {
  async onInit(): Promise<void> { }
  async onSettings({ oldSettings, newSettings, changedKeys }: {
    oldSettings: object;
    newSettings: object;
    changedKeys: string[];
  }): Promise<void> { }
  async onDeleted(): Promise<void> { }
}
```

### Manager Access

```typescript
this.homey.app           // App instance
this.homey.flow          // Flow manager
this.homey.drivers       // Drivers manager
this.homey.api           // API manager
this.homey.settings      // Settings manager
this.homey.i18n          // Internationalization
this.homey.geolocation   // Location
this.homey.clock         // Time/timezone
```

### Common Device Methods

```typescript
// Capabilities
await this.setCapabilityValue('onoff', true);
const value = await this.getCapabilityValue('onoff') as boolean;
this.registerCapabilityListener('onoff', async (value: boolean) => { });

// Settings
const settings = this.getSettings() as Record<string, unknown>;
await this.setSettings({ key: 'value' });

// Store
const storedValue = this.getStoreValue('key') as string;
await this.setStoreValue('key', 'value');

// Availability
await this.setAvailable();
await this.setUnavailable('Reason');

// Info
const name = this.getName();
const data = this.getData();
```

### Flow Cards

```typescript
// Get card
const trigger = this.homey.flow.getTriggerCard('my_trigger');
const action = this.homey.flow.getActionCard('my_action');
const condition = this.homey.flow.getConditionCard('my_condition');

// Trigger
await trigger.trigger({ token: 'value' });

// Register
action.registerRunListener(async (args: Record<string, unknown>) => { return true; });
condition.registerRunListener(async (args: Record<string, unknown>) => { return true; });
```

---

**End of Homey App Development Guide (SDK v3)
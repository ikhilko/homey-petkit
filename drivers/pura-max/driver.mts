import { BaseLitterBoxDriver } from '../../lib/base/index.mjs';
import { DeviceType } from '../../lib/petkit-api/index.mjs';

/**
 * PetKit Pura MAX (T4) Litter Box Driver
 */
class PuraMaxDriver extends BaseLitterBoxDriver {
  protected getModelName(): string {
    return 'Pura MAX';
  }

  protected getSupportedDeviceTypes(): DeviceType[] {
    return [DeviceType.T4];
  }
}

export default PuraMaxDriver;

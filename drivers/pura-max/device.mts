import { BaseLitterBoxDevice } from '../../lib/base/index.mjs';

/**
 * PetKit Pura MAX (T4) Litter Box Device
 */
class PuraMaxDevice extends BaseLitterBoxDevice {
  protected getModelName(): string {
    return 'Pura MAX';
  }
}

export default PuraMaxDevice;

import { brandConfig } from '@config/brand';

if (!brandConfig.displayName) {
  throw new Error('brandConfig.displayName must be set');
}

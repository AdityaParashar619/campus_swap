import { randomUUID } from 'node:crypto';

export const legacyAssetNamespace = 'campusswap';
export const facultyAssetNamespace = 'campusswap-faculty';
export const assetNamespace = () => process.env.CLOUDINARY_ASSET_NAMESPACE ??
  (process.env.CAMPUSSWAP_FACULTY_DEMO_MODE === 'true' ? facultyAssetNamespace : legacyAssetNamespace);

export const usesScopedAssets = () => assetNamespace() !== legacyAssetNamespace;
export const assetFolder = (kind) => assetNamespace() + '/' + kind;

const entityPattern = /^[0-9a-f]{24}$/;
const uniqueNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function makeScopedAssetId(kind, entityId, extension = '') {
  if (!entityPattern.test(String(entityId))) throw new Error('Invalid asset owner identity');
  return assetFolder(kind) + '/' + entityId + '-' + randomUUID() + extension;
}

export function ownsScopedAsset(publicId, kind, entityId, extension = '') {
  if (typeof publicId !== 'string' || !entityPattern.test(String(entityId))) return false;
  const prefix = assetFolder(kind) + '/' + entityId + '-';
  return publicId.startsWith(prefix) && publicId.endsWith(extension) &&
    uniqueNamePattern.test(publicId.slice(prefix.length, publicId.length - extension.length));
}

export function matchesScopedUpload(result, expectedId) {
  return result?.public_id === expectedId && result.existing !== true;
}

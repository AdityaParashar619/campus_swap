import { readdir } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const modelsDir = new URL('../models/', import.meta.url);
let models;

function loadModels() {
  models ??= readdir(modelsDir).then((files) => Promise.all(files.filter((file) => file.endsWith('.js')).sort()
    .map(async (file) => (await import(new URL(file, modelsDir))).default)));
  return models;
}

export const isDemoDatabase = (name) => /^campusswap_demo(?:_[a-z0-9]+)?$/.test(name);
export const isNewDeploymentDatabase = (name) => isDemoDatabase(name) || /^campusswap_release_[a-z0-9]+$/.test(name);

function sameKeys(actual, expected) {
  return isDeepStrictEqual(Object.entries(actual), Object.entries(expected));
}

function storedIndexKey(key) {
  const stored = {};
  for (const [field, order] of Object.entries(key)) {
    if (order === 'text') Object.assign(stored, { _fts: 'text', _ftsx: 1 });
    else stored[field] = order;
  }
  return stored;
}

function comparableOptions(index) {
  return {
    unique: Boolean(index.unique),
    sparse: Boolean(index.sparse),
    hidden: Boolean(index.hidden),
    expireAfterSeconds: index.expireAfterSeconds ?? null,
    partialFilterExpression: index.partialFilterExpression ?? null,
    collation: index.collation?.locale === 'simple' ? null : index.collation ?? null
  };
}

export async function inspectDeploymentIndexes(database) {
  const missing = [];
  for (const model of await loadModels()) {
    const collection = database.collection(model.collection.name);
    let indexes;
    try {
      indexes = await collection.listIndexes().toArray();
    } catch (error) {
      if (error.code !== 26) throw error; // A fresh database may not have the collection.
      indexes = [];
    }

    for (const [key, options] of model.schema.indexes()) {
      const name = options.name ?? Object.entries(key).map(([field, order]) => `${field}_${order}`).join('_');
      const textWeights = Object.fromEntries(Object.entries(key).filter(([, order]) => order === 'text')
        .map(([field]) => [field, options.weights?.[field] ?? 1]));
      const isText = Object.keys(textWeights).length > 0;
      const expectedKey = storedIndexKey(key);
      const existing = indexes.find((index) => index.name === name);
      if (existing) {
        if (!sameKeys(existing.key, expectedKey) || (isText && (!isDeepStrictEqual(existing.weights, textWeights) ||
            existing.default_language !== (options.default_language ?? 'english') ||
            existing.language_override !== (options.language_override ?? 'language'))) ||
            !isDeepStrictEqual(comparableOptions(existing), comparableOptions(options))) {
          throw new Error(`Conflicting index definition: ${collection.collectionName}.${name}`);
        }
      } else {
        if (indexes.some((index) => isText ? index.key._fts === 'text' : sameKeys(index.key, key))) {
          throw new Error(`Conflicting index key or name: ${collection.collectionName}.${name}`);
        }
        missing.push({ collection, key, options: { ...options, name } });
      }
    }
  }
  return missing;
}

export async function verifyDeploymentIndexes(database) {
  const missing = await inspectDeploymentIndexes(database);
  if (missing.length) throw new Error(`Missing required deployment indexes: ${missing.length}`);
}

export async function prepareFreshDeploymentIndexes(database) {
  if (!isNewDeploymentDatabase(database.databaseName)) throw new Error('Refusing to provision indexes outside a named deployment database');
  const missing = await inspectDeploymentIndexes(database);
  if (!missing.length) return 0;
  // This command is deliberately fresh-only. A populated target requires a separate
  // maintenance procedure, including duplicate reconciliation and a verified backup.
  const collections = await database.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (await database.collection(name).estimatedDocumentCount() > 0) {
      throw new Error('Refusing index changes on a populated deployment database');
    }
  }

  for (const { collection, key, options } of missing) {
    await collection.createIndex(key, options);
  }
  await verifyDeploymentIndexes(database);
  return missing.length;
}

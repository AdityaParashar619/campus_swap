// Run with mongosh against the loopback listener inside the selected MongoDB container.
(() => {
  const collectionName = 'emailverifications';
  const indexName = 'email_1_kind_1';
  const key = { email: 1, kind: 1 };
  const live = 'campusswap';
  const rehearsal = 'campusswap_otp_index_rehearsal_test';
  const restore = 'campusswap_otp_index_restore_test';

  function requireCondition(condition, reason) {
    if (!condition) throw Object.assign(new Error(reason), { safeReason: reason });
  }

  function sameKey(index) {
    const entries = Object.entries(index.key);
    return entries.length === 2 && entries[0][0] === 'email' && entries[0][1] === 1
      && entries[1][0] === 'kind' && entries[1][1] === 1;
  }

  const exact = (index) => index.name === indexName && sameKey(index) && index.unique === true
    && !index.sparse && !index.hidden && !index.partialFilterExpression
    && index.expireAfterSeconds === undefined && (!index.collation || index.collation.locale === 'simple');

  function duplicateGroups(email, kind) {
    return [{ $group: { _id: { email, kind }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $count: 'groups' }];
  }

  function snapshot(collection) {
    const [result] = collection.aggregate([
      { $project: {
        email: 1, kind: 1, emailType: { $type: '$email' }, kindType: { $type: '$kind' },
        emailText: { $cond: [{ $eq: [{ $type: '$email' }, 'string'] }, '$email', ''] },
        kindText: { $cond: [{ $eq: [{ $type: '$kind' }, 'string'] }, '$kind', ''] }
      } },
      { $set: {
        normalizedEmail: { $toLower: { $trim: { input: '$emailText' } } },
        normalizedKind: { $toLower: { $trim: { input: '$kindText' } } }
      } },
      { $facet: {
        fields: [{ $group: {
          _id: null, documents: { $sum: 1 },
          emailMissing: { $sum: { $cond: [{ $eq: ['$emailType', 'missing'] }, 1, 0] } },
          emailNull: { $sum: { $cond: [{ $eq: ['$emailType', 'null'] }, 1, 0] } },
          emailOtherType: { $sum: { $cond: [{ $not: [{ $in: ['$emailType', ['string', 'missing', 'null']] }] }, 1, 0] } },
          emailMalformed: { $sum: { $cond: [{ $and: [
            { $eq: ['$emailType', 'string'] },
            { $not: [{ $regexMatch: { input: '$normalizedEmail', regex: /^[\x21-\x3f\x41-\x7e]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/ } }] }
          ] }, 1, 0] } },
          emailNonCanonical: { $sum: { $cond: [{ $ne: ['$emailText', '$normalizedEmail'] }, 1, 0] } },
          kindMissing: { $sum: { $cond: [{ $eq: ['$kindType', 'missing'] }, 1, 0] } },
          kindNull: { $sum: { $cond: [{ $eq: ['$kindType', 'null'] }, 1, 0] } },
          kindOtherType: { $sum: { $cond: [{ $not: [{ $in: ['$kindType', ['string', 'missing', 'null']] }] }, 1, 0] } },
          kindInvalid: { $sum: { $cond: [{ $and: [
            { $eq: ['$kindType', 'string'] }, { $not: [{ $in: ['$kindText', ['student', 'password_reset']] }] }
          ] }, 1, 0] } }
        } }],
        exactDuplicates: duplicateGroups('$email', '$kind'),
        normalizedDuplicates: [{ $match: { emailType: 'string', kindType: 'string' } },
          ...duplicateGroups('$normalizedEmail', '$normalizedKind')]
      } }
    ]).toArray();
    const { _id, ...fields } = result.fields[0] || {};
    const indexCatalog = collection.getIndexes();
    const requiredPresent = indexCatalog.some(exact);
    const conflicts = indexCatalog.filter((index) => (index.name === indexName || sameKey(index)) && !exact(index));
    const counts = Object.fromEntries([
      'documents', 'emailMissing', 'emailNull', 'emailOtherType', 'emailMalformed', 'emailNonCanonical',
      'kindMissing', 'kindNull', 'kindOtherType', 'kindInvalid'
    ].map((name) => [name, fields[name] ?? 0]));
    counts.exactDuplicateGroups = result.exactDuplicates[0]?.groups ?? 0;
    counts.normalizedDuplicateGroups = result.normalizedDuplicates[0]?.groups ?? 0;
    const dirtyData = Object.entries(counts).some(([name, value]) => name !== 'documents' && value !== 0);
    const indexes = indexCatalog.map(({ name, key, v, unique, background, expireAfterSeconds, sparse, hidden, partialFilterExpression, collation }) => ({
      name, key, v, unique, background, expireAfterSeconds, sparse, hidden,
      ...(partialFilterExpression && { partial: true }),
      ...(collation && { collationLocale: collation.locale })
    }));
    return { counts, indexes, requiredPresent,
      conflicts: conflicts.map((index) => index.name), readyForApply: !dirtyData && conflicts.length === 0 };
  }

  try {
    const name = db.getName();
    const mode = process.env.OTP_INDEX_MODE || 'preflight';
    requireCondition(['preflight', 'apply'].includes(mode), 'Unknown operation.');
    requireCondition([live, rehearsal, restore].includes(name), 'Database is outside the allowlist.');
    requireCondition(/^mongodb:\/\/127\.0\.0\.1:27017(?:[/?]|$)/.test(db.getMongo().getURI()),
      'Use the local MongoDB listener inside the selected container.');
    const hello = db.adminCommand({ hello: 1 });
    requireCondition(hello.ok === 1 && hello.isWritablePrimary && !hello.setName && hello.msg !== 'isdbgrid',
      'Expected a writable standalone MongoDB server.');
    const info = db.getCollectionInfos({ name: collectionName })[0];
    requireCondition(info?.type === 'collection', 'Expected an existing OTP collection.');
    const options = info.options;
    requireCondition(!options.collation || options.collation.locale === 'simple', 'Unexpected collection collation.');
    const collection = db.getCollection(collectionName);
    const before = snapshot(collection);
    printjson({ database: name, collection: collectionName, mode, ...before });
    if (mode === 'preflight') return;

    const approval = process.env.OTP_INDEX_APPROVAL;
    requireCondition((name === live && approval === 'APPROVED_CAMPUSSWAP_OTP_INDEX_49A')
      || (name === rehearsal && approval === 'REHEARSAL_ONLY'), 'Explicit target-specific approval is required.');
    requireCondition(before.readyForApply, 'Preflight found data problems or conflicting index metadata.');
    if (before.requiredPresent) {
      printjson({ result: 'already-present', index: indexName });
      return;
    }
    const result = db.runCommand({
      createIndexes: collectionName, indexes: [{ key, name: indexName, unique: true }],
      writeConcern: { w: 1, j: true }
    });
    if (result.ok !== 1 || result.writeConcernError) {
      throw Object.assign(new Error('Index creation failed.'), { code: result.code ?? result.writeConcernError?.code });
    }
    requireCondition(collection.getIndexes().some(exact), 'The exact index could not be verified.');
    printjson({ result: 'created-and-verified', index: indexName });
  } catch (error) {
    // A MongoDB duplicate-key error can contain the email or other indexed values.
    printjson({ result: 'blocked', reason: error.safeReason || 'MongoDB operation failed.',
      ...(Number.isInteger(error.code) && { code: error.code }) });
    quit(1);
  }
})();

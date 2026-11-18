import mongoose from 'mongoose';

export const parseSummaryPagination = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 50, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const buildConversationSummaryPipeline = (currentUserId, { skip, limit }) => {
  const userId = new mongoose.Types.ObjectId(currentUserId);
  return [
    { $match: { $or: [{ sender: userId }, { receiver: userId }] } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $project: {
      participantId: { $cond: [{ $eq: ['$sender', userId] }, '$receiver', '$sender'] },
      text: 1,
      createdAt: 1
    } },
    { $group: { _id: '$participantId', lastMessage: { $first: { text: '$text', createdAt: '$createdAt' } } } },
    { $sort: { 'lastMessage.createdAt': -1, _id: 1 } },
    { $facet: {
      data: [{ $skip: skip }, { $limit: limit }, { $project: { _id: 0, participantId: { $toString: '$_id' }, lastMessage: 1 } }],
      metadata: [{ $count: 'total' }]
    } }
  ];
};

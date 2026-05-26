import Connection from '../models/Connection.js';
import Message from '../models/Message.js';

export const getConnectionBetweenUsers = (userId, otherUserId) =>
  Connection.findOne({
    status: 'accepted',
    $or: [
      { requester: userId, recipient: otherUserId },
      { requester: otherUserId, recipient: userId }
    ]
  });

export const areUsersConnected = async (userId, otherUserId) => Boolean(await getConnectionBetweenUsers(userId, otherUserId));

export const getChatAccess = async (userId, otherUserId) => {
  const isConnected = await areUsersConnected(userId, otherUserId);
  if (isConnected) {
    return { isConnected: true, starterUsed: false, canSend: true };
  }

  const starterUsed = await Message.exists({ sender: userId, receiver: otherUserId });
  return {
    isConnected: false,
    starterUsed: Boolean(starterUsed),
    canSend: !starterUsed
  };
};

export const exposeContactForConnection = (student, isConnected) => {
  const data = student.toObject ? student.toObject() : { ...student };
  if (!isConnected || data.contactVisibility !== 'connections') {
    delete data.email;
    delete data.phoneNumber;
    delete data.whatsappNumber;
  }
  return data;
};

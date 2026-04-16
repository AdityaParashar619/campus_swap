import Message from '../models/Message.js';

export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user.userId;

    if (!receiverId || !text) {
      return res.status(400).json({ error: 'Receiver and text required' });
    }

    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      text
    });

    await message.save();
    await message.populate('sender receiver', 'name email');

    // Emit via Socket.io if available
    const io = req.app.locals.io;
    if (io) {
      io.to(receiverId).emit('receiveMessage', message);
    }

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    })
      .populate('sender receiver', 'name email')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

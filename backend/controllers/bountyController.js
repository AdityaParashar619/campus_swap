import Bounty from '../models/Bounty.js';

export const createBounty = async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = req.user.userId;

    if (!title) {
      return res.status(400).json({ error: 'Title required' });
    }

    const bounty = new Bounty({
      title,
      description,
      user: userId
    });

    await bounty.save();
    res.status(201).json({ message: 'Bounty created', bounty });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBounties = async (req, res) => {
  try {
    const bounties = await Bounty.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(bounties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

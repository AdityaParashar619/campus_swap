import Listing from '../models/Listing.js';

export const createListing = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const userId = req.user.userId;

    if (!title) {
      return res.status(400).json({ error: 'Title required' });
    }

    const listing = new Listing({
      title,
      description,
      category,
      user: userId
    });

    await listing.save();
    res.status(201).json({ message: 'Listing created', listing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getListings = async (req, res) => {
  try {
    const listings = await Listing.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.user.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Listing.findByIdAndDelete(id);
    res.json({ message: 'Listing deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

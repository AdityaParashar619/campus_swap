import bcrypt from 'bcrypt';
import jwt from 'jwt-simple';
import User from '../models/User.js';

const SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const register = async (req, res) => {
  try {
    const { name, email, enrollmentNumber, password } = req.body;

    // Validate input
    if (!name || !email || !enrollmentNumber || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { enrollmentNumber }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email or enrollment number already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      enrollmentNumber,
      password: hashedPassword
    });

    await user.save();

    // Generate token
    const token = jwt.encode({ userId: user._id, email: user.email }, SECRET);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.encode({ userId: user._id, email: user.email }, SECRET);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    // Get all users except current user
    const users = await User.find({ _id: { $ne: currentUserId } }).select('name email _id');

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

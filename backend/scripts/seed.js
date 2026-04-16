import bcrypt from 'bcrypt';
import Bounty from '../models/Bounty.js';
import Listing from '../models/Listing.js';
import User from '../models/User.js';

const DEMO_USERS = [
  {
    name: 'Bhavesh Patidar',
    email: 'bhavesh@campus.edu',
    enrollmentNumber: 'EN001',
    password: 'password123'
  },
  {
    name: 'Murtaza Millwala',
    email: 'murtaza@campus.edu',
    enrollmentNumber: 'EN002',
    password: 'password123'
  },
  {
    name: 'Anurag Sharma',
    email: 'anurag@campus.edu',
    enrollmentNumber: 'EN003',
    password: 'password123'
  },
  {
    name: 'Dakshesh Jat',
    email: 'dakshesh@campus.edu',
    enrollmentNumber: 'EN004',
    password: 'password123'
  },
  {
    name: 'Lavkesh Bharti',
    email: 'lavkesh@campus.edu',
    enrollmentNumber: 'EN005',
    password: 'password123'
  }
];

const DEMO_LISTINGS = [
  {
    title: 'Data Structures Notes',
    description: 'Complete notes for DSA course including arrays, linked lists, trees, and graphs. Well-organized and easy to understand.',
    category: 'Textbooks',
    userIndex: 2 // Anurag
  },
  {
    title: 'Graphic Design Help',
    description: 'Professional graphic designer offering help with Figma, Adobe Creative Suite, logo design, and UI mockups.',
    category: 'Services',
    userIndex: 3 // Dakshesh
  },
  {
    title: 'Laptop for 2 Days',
    description: 'MacBook Pro 13" available for borrowing. Good condition, fully charged. Requires ID and deposit.',
    category: 'Electronics',
    userIndex: 0 // Bhavesh
  },
  {
    title: 'Web Development Project Help',
    description: 'Help with React, Node.js, MongoDB stack projects. Can assist with frontend architecture and API design.',
    category: 'Services',
    userIndex: 4 // Lavkesh
  },
  {
    title: 'Math Tutoring',
    description: 'Expert tutoring in Calculus, Linear Algebra, and Differential Equations. One-on-one sessions available.',
    category: 'Services',
    userIndex: 1 // Murtaza
  }
];

const DEMO_BOUNTIES = [
  {
    title: 'Need calculator urgently',
    description: 'Looking for a scientific calculator for exam tomorrow. Will appreciate if someone can lend one for a few hours.',
    userIndex: 0 // Bhavesh
  },
  {
    title: 'Looking for React help',
    description: 'Need assistance with React hooks and state management. Having trouble with useContext and custom hooks.',
    userIndex: 1 // Murtaza
  },
  {
    title: 'Need notes for exam',
    description: 'Missed some classes due to illness. Looking for notes from last week lectures in Database Management course.',
    userIndex: 3 // Dakshesh
  }
];

export const seedDatabase = async () => {
  try {
    // Check if database already has users
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('📌 Database already seeded, skipping...');
      return;
    }

    console.log('🌱 Starting database seeding...');

    // Hash passwords and create users
    const hashedUsers = await Promise.all(
      DEMO_USERS.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10)
      }))
    );

    // Insert users and get IDs
    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`✓ Created ${createdUsers.length} demo users`);

    // Create listings with user references
    const listingsWithUsers = DEMO_LISTINGS.map((listing) => ({
      ...listing,
      user: createdUsers[listing.userIndex]._id
    }));

    const createdListings = await Listing.insertMany(listingsWithUsers);
    console.log(`✓ Created ${createdListings.length} demo listings`);

    // Create bounties with user references
    const bountiesWithUsers = DEMO_BOUNTIES.map((bounty) => ({
      ...bounty,
      user: createdUsers[bounty.userIndex]._id
    }));

    const createdBounties = await Bounty.insertMany(bountiesWithUsers);
    console.log(`✓ Created ${createdBounties.length} demo bounties`);

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    // Don't throw - allow server to start even if seeding fails
  }
};

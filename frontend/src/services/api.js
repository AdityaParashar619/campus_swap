import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// Add JWT token to all requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  getUsers: () => API.get('/auth/users')
};

// Listing APIs
export const listingAPI = {
  getAll: () => API.get('/listings'),
  create: (data) => API.post('/listings', data),
  delete: (id) => API.delete(`/listings/${id}`)
};

// Bounty APIs
export const bountyAPI = {
  getAll: () => API.get('/bounties'),
  create: (data) => API.post('/bounties', data)
};

// Message APIs
export const messageAPI = {
  send: (data) => API.post('/messages', data),
  getChat: (userId) => API.get(`/messages/${userId}`)
};

export default API;

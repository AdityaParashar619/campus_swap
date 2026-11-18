const applicationDatabase = process.env.MONGO_APP_DATABASE;
const applicationUsername = process.env.MONGO_APP_USERNAME;
const applicationPassword = process.env.MONGO_APP_PASSWORD;

if (!applicationDatabase || !applicationUsername || !applicationPassword) {
  throw new Error('MongoDB application-user initialization requires database, username, and password');
}

db.getSiblingDB(applicationDatabase).createUser({
  user: applicationUsername,
  pwd: applicationPassword,
  roles: [{ role: 'readWrite', db: applicationDatabase }]
});

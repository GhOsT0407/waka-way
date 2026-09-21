module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/attic/'],
  setupFiles: ['@react-native-async-storage/async-storage/jest/async-storage-mock'],
};

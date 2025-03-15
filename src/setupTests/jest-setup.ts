// This file is automatically loaded by Jest
import '@testing-library/jest-dom';

// Mock global fetch
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.resetAllMocks();
}); 
#!/usr/bin/env node

/**
 * This script tests the authentication functionality by making requests to the test API endpoints.
 * It helps verify that authentication is working correctly.
 */

const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:3000';
const AUTH_TEST_URL = `${BASE_URL}/api/auth/test`;
const PLAYLIST_TEST_URL = `${BASE_URL}/api/playlists/test`;

/**
 * Makes a request to the test API endpoint
 * 
 * @param {string} url - The URL to request
 * @param {Object} options - The request options
 * @returns {Promise<Object>} The response data
 */
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    
    const data = await response.json();
    
    return {
      status: response.status,
      data,
    };
  } catch (error) {
    console.error(`Error making request to ${url}:`, error);
    return {
      status: 500,
      data: { error: error.message },
    };
  }
}

/**
 * Tests the authentication API
 */
async function testAuthAPI() {
  console.log('Testing Authentication API...');
  
  const result = await makeRequest(AUTH_TEST_URL);
  
  console.log(`Status: ${result.status}`);
  console.log('Response:');
  console.log(JSON.stringify(result.data, null, 2));
  
  return result;
}

/**
 * Tests the playlist API
 */
async function testPlaylistAPI() {
  console.log('\nTesting Playlist API...');
  
  const result = await makeRequest(PLAYLIST_TEST_URL);
  
  console.log(`Status: ${result.status}`);
  console.log('Response:');
  console.log(JSON.stringify(result.data, null, 2));
  
  return result;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Musync API Test ===\n');
  
  const authResult = await testAuthAPI();
  
  if (authResult.data.authenticated) {
    console.log('\n✅ Authentication successful!');
    await testPlaylistAPI();
  } else {
    console.log('\n❌ Not authenticated. Please log in first.');
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the main function
main().catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
}); 
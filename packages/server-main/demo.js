#!/usr/bin/env node

// Simple demo script to test the REST API server
// Usage: node demo.js

const baseUrl = 'http://localhost:3000/api';

async function makeRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, options);
    const result = await response.json();
    
    console.log(`${method} ${path}:`, response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    console.log('---');
    
    return result;
  } catch (error) {
    console.error(`Error ${method} ${path}:`, error.message);
    return null;
  }
}

async function demo() {
  console.log('🚀 Testing REST API Server\n');

  // Test schemas endpoints
  console.log('📋 Testing Schemas...\n');

  // Create a schema
  const schema = {
    id: 'test-schema',
    name: 'Test Schema',
    source: 'external',
    fields: [
      { id: 'name', name: 'Name', type: 'text' },
      { id: 'description', name: 'Description', type: 'longtext' }
    ]
  };

  await makeRequest('POST', '/schemas', schema);
  await makeRequest('GET', '/schemas');
  await makeRequest('GET', '/schemas/test-schema');

  // Test data endpoints
  console.log('📊 Testing Data...\n');

  // Create some data
  const data1 = {
    _uid: 'test-1',
    _schemaId: 'test-schema',
    name: 'Test Item 1',
    description: 'First test item'
  };

  const data2 = {
    _uid: 'test-2', 
    _schemaId: 'test-schema',
    name: 'Test Item 2',
    description: 'Second test item'
  };

  await makeRequest('POST', '/data', data1);
  await makeRequest('POST', '/data', data2);
  await makeRequest('GET', '/data');
  await makeRequest('GET', '/data/test-1');

  // Update data
  const updatedData = {
    ...data1,
    name: 'Updated Test Item 1',
    description: 'Updated description'
  };
  await makeRequest('PUT', '/data/test-1', updatedData);
  await makeRequest('GET', '/data/test-1');

  // Delete data
  await makeRequest('DELETE', '/data/test-2');
  await makeRequest('GET', '/data');

  // Clean up schema
  await makeRequest('DELETE', '/schemas/test-schema');
  await makeRequest('GET', '/schemas');

  console.log('✅ Demo completed!');
}

// Check if server is running
fetch(`${baseUrl}/schemas`)
  .then(() => {
    console.log('✅ Server is running, starting demo...\n');
    demo();
  })
  .catch(() => {
    console.log('❌ Server is not running!');
    console.log('Start the server first with: pnpm dev');
  });
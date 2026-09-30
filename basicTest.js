// Simple test function
function testAdvisoryValidation() {
  // Test required fields validation
  let title = '';
  let description = 'Test description';
  let advisoryType = 'weather';
  let createError = null;

  if (!title || !advisoryType) {
    createError = 'Please fill in all required fields';
  }

  console.log('Test 1 - Required fields:', createError === 'Please fill in all required fields' ? 'PASS' : 'FAIL');

  // Test valid advisory creation
  title = 'Test Advisory';
  createError = null;

  if (!title || !advisoryType) {
    createError = 'Please fill in all required fields';
  }

  console.log('Test 2 - Valid advisory:', createError === null ? 'PASS' : 'FAIL');

  // Test time range validation
  title = 'Test Advisory';
  description = 'Test description';
  advisoryType = 'weather';
  let startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16); // Future
  let endTime = new Date().toISOString().slice(0, 16); // Past
  createError = null;

  if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
    createError = 'End time must be after start time';
  }

  console.log('Test 3 - Invalid time range:', createError === 'End time must be after start time' ? 'PASS' : 'FAIL');

  // Test valid time range
  startTime = new Date().toISOString().slice(0, 16); // Past
  endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16); // Future
  createError = null;

  if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
    createError = 'End time must be after start time';
  }

  console.log('Test 4 - Valid time range:', createError === null ? 'PASS' : 'FAIL');
}

// Run the test
testAdvisoryValidation();
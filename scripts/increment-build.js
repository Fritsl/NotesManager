#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the version file
const versionFilePath = path.resolve(__dirname, '../client/src/version.ts');

try {
  // Read the current version file
  const content = fs.readFileSync(versionFilePath, 'utf8');
  
  // Extract the build number using regex
  const buildNumberMatch = content.match(/buildNumber = (\d+)/);
  
  if (!buildNumberMatch) {
    console.error('Could not find build number in version file');
    process.exit(1);
  }
  
  // Parse the current build number
  const currentBuildNumber = parseInt(buildNumberMatch[1], 10);
  
  // Increment the build number
  const newBuildNumber = currentBuildNumber + 1;
  
  // Replace the build number in the file content
  const updatedContent = content.replace(
    /buildNumber = \d+/,
    `buildNumber = ${newBuildNumber}`
  );
  
  // Write the updated content back to the file
  fs.writeFileSync(versionFilePath, updatedContent, 'utf8');
  
  console.log(`Build number incremented from ${currentBuildNumber} to ${newBuildNumber}`);
} catch (error) {
  console.error('Error incrementing build number:', error);
  process.exit(1);
}
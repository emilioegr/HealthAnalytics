const { GarminConnect } = require('garmin-connect');
const fs = require('fs').promises;
const path = require('path');

class GarminDataDownloader {
  constructor() {
    this.GCClient = new GarminConnect({
      username: '',
      password: ''
    });
    this.isAuthenticated = false;
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  // Utility: Sleep function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility: Retry wrapper for API calls
  async retryOperation(operation, operationName, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = i === attempts - 1;
        
        if (isLastAttempt) {
          console.error(`✗ ${operationName} failed after ${attempts} attempts:`, error.message);
          throw error;
        }
        
        console.warn(`⚠ ${operationName} attempt ${i + 1} failed, retrying in ${this.retryDelay}ms...`);
        await this.sleep(this.retryDelay);
      }
    }
  }

  async loginWithTokens(tokenFile = 'garmin_tokens.json') {
    try {
      console.log('Attempting to login using OAuth tokens...');
      
      // Load tokens from file
      const tokenData = JSON.parse(await fs.readFile(tokenFile, 'utf8'));
      
      if (!tokenData.oauth1 || !tokenData.oauth2) {
        throw new Error('Invalid token file. Please regenerate tokens.');
      }
      
      // Set tokens on the client
      this.GCClient.client.oauth1Token = tokenData.oauth1;
      this.GCClient.client.oauth2Token = tokenData.oauth2;
      
      this.isAuthenticated = true;
      console.log('✓ Successfully authenticated using OAuth tokens');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Token file not found. Please run the Python token generator first.');
      }
      throw new Error(`Token authentication failed: ${error.message}`);
    }
  }

  async login(username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    try {
      console.log('Attempting to login to Garmin Connect...');
      this.GCClient = new GarminConnect({
        username: username,
        password: password
      });
      
      await this.retryOperation(
        () => this.GCClient.login(),
        'Login'
      );
      
      this.isAuthenticated = true;
      console.log('✓ Successfully logged in to Garmin Connect');
      return true;
    } catch (error) {
      if (error.message.includes('Invalid credentials') || error.message.includes('401')) {
        throw new Error('Invalid username or password. Please check your credentials.');
      } else if (error.message.includes('MFA') || error.message.includes('2FA')) {
        throw new Error('Two-factor authentication detected. Please run the Python token generator to create OAuth tokens.');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async getUserProfile() {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    try {
      const profile = await this.retryOperation(
        () => this.GCClient.getUserProfile(),
        'Get User Profile'
      );
      
      console.log('\n=== User Profile ===');
      console.log(`Name: ${profile.displayName || 'N/A'}`);
      console.log(`Email: ${profile.emailAddress || 'N/A'}`);
      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error.message);
      return null; // Return null instead of throwing to allow partial data downloads
    }
  }

  async getActivityData(startDate, endDate, limit = 100) {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    try {
      console.log('\n=== Fetching Activity Data ===');
      const activities = await this.retryOperation(
        () => this.GCClient.getActivities(0, limit),
        'Get Activities'
      );
      
      console.log(`Found ${activities ? activities.length : 0} activities`);
      return activities || [];
    } catch (error) {
      console.error('Error fetching activities:', error.message);
      return [];
    }
  }

  async getDailySummary(date) {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    try {
      const formattedDate = this.formatDate(date);
      console.log(`\n=== Daily Summary for ${formattedDate} ===`);
      
      const summary = await this.retryOperation(
        () => this.GCClient.getDailySummary(formattedDate),
        `Get Daily Summary for ${formattedDate}`
      );
      
      if (summary) {
        console.log(`Steps: ${summary.totalSteps || 'N/A'}`);
        console.log(`Calories: ${summary.totalKilocalories || 'N/A'}`);
        console.log(`Distance: ${summary.totalDistanceMeters ? (summary.totalDistanceMeters / 1000).toFixed(2) + ' km' : 'N/A'}`);
        console.log(`Active Minutes: ${summary.activeTimeInSeconds ? Math.round(summary.activeTimeInSeconds / 60) : 'N/A'} min`);
      }
      
      return summary;
    } catch (error) {
      console.error(`Error fetching daily summary for ${date}:`, error.message);
      return null;
    }
  }

  async getHeartRateData(date) {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    try {
      const formattedDate = this.formatDate(date);
      console.log(`\n=== Heart Rate Data for ${formattedDate} ===`);
      
      const heartRate = await this.retryOperation(
        () => this.GCClient.getHeartRate(formattedDate),
        `Get Heart Rate for ${formattedDate}`
      );
      
      if (heartRate && heartRate.heartRateValues) {
        console.log(`Resting HR: ${heartRate.restingHeartRate || 'N/A'} bpm`);
        console.log(`Max HR: ${heartRate.maxHeartRate || 'N/A'} bpm`);
        console.log(`Min HR: ${heartRate.minHeartRate || 'N/A'} bpm`);
      }
      
      return heartRate;
    } catch (error) {
      console.error(`Error fetching heart rate for ${date}:`, error.message);
      return null;
    }
  }

  async getSleepData(date) {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    try {
      const formattedDate = this.formatDate(date);
      console.log(`\n=== Sleep Data for ${formattedDate} ===`);
      
      const sleep = await this.retryOperation(
        () => this.GCClient.getSleep(formattedDate),
        `Get Sleep Data for ${formattedDate}`
      );
      
      if (sleep && sleep.dailySleepDTO) {
        const sleepHours = sleep.dailySleepDTO.sleepTimeSeconds / 3600;
        console.log(`Total Sleep: ${sleepHours.toFixed(2)} hours`);
        console.log(`Deep Sleep: ${sleep.dailySleepDTO.deepSleepSeconds ? (sleep.dailySleepDTO.deepSleepSeconds / 3600).toFixed(2) : 'N/A'} hours`);
        console.log(`Light Sleep: ${sleep.dailySleepDTO.lightSleepSeconds ? (sleep.dailySleepDTO.lightSleepSeconds / 3600).toFixed(2) : 'N/A'} hours`);
        console.log(`REM Sleep: ${sleep.dailySleepDTO.remSleepSeconds ? (sleep.dailySleepDTO.remSleepSeconds / 3600).toFixed(2) : 'N/A'} hours`);
      }
      
      return sleep;
    } catch (error) {
      console.error(`Error fetching sleep data for ${date}:`, error.message);
      return null;
    }
  }

  async getStressData(date) {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    try {
      const formattedDate = this.formatDate(date);
      console.log(`\n=== Stress Data for ${formattedDate} ===`);
      
      const stress = await this.retryOperation(
        () => this.GCClient.getStress(formattedDate),
        `Get Stress Data for ${formattedDate}`
      );
      
      if (stress) {
        console.log(`Average Stress Level: ${stress.avgStressLevel || 'N/A'}`);
        console.log(`Max Stress Level: ${stress.maxStressLevel || 'N/A'}`);
      }
      
      return stress;
    } catch (error) {
      console.error(`Error fetching stress data for ${date}:`, error.message);
      return null;
    }
  }

  formatDate(date) {
    if (!date) return new Date().toISOString().split('T')[0];
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return new Date(date).toISOString().split('T')[0];
  }

  async downloadDayData(date) {
    const formattedDate = this.formatDate(date);
    
    const dayData = {
      date: formattedDate,
      dailySummary: null,
      heartRate: null,
      sleep: null,
      stress: null,
      downloadedAt: new Date().toISOString(),
      errors: []
    };

    try {
      dayData.dailySummary = await this.getDailySummary(formattedDate);
      await this.sleep(500); // Rate limiting
      
      dayData.heartRate = await this.getHeartRateData(formattedDate);
      await this.sleep(500);
      
      dayData.sleep = await this.getSleepData(formattedDate);
      await this.sleep(500);
      
      dayData.stress = await this.getStressData(formattedDate);
      await this.sleep(500);

    } catch (error) {
      dayData.errors.push(error.message);
      console.error(`Error downloading data for ${formattedDate}:`, error.message);
    }

    return dayData;
  }

  async downloadBulkData(startDate, endDate) {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    console.log('\n========================================');
    console.log('Starting Bulk Data Download');
    console.log('========================================\n');
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const bulkData = {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
      profile: null,
      activities: null,
      dailyData: [],
      summary: {
        totalDays: 0,
        successfulDays: 0,
        failedDays: 0
      },
      downloadedAt: new Date().toISOString()
    };

    try {
      // Get profile once
      bulkData.profile = await this.getUserProfile();
      await this.sleep(1000);
      
      // Get activities once
      bulkData.activities = await this.getActivityData();
      await this.sleep(1000);

      // Download daily data for each day in range
      const currentDate = new Date(start);
      
      while (currentDate <= end) {
        const dateStr = this.formatDate(currentDate);
        console.log(`\n--- Downloading data for ${dateStr} ---`);
        
        try {
          const dayData = await this.downloadDayData(dateStr);
          bulkData.dailyData.push(dayData);
          bulkData.summary.totalDays++;
          
          if (dayData.errors.length === 0) {
            bulkData.summary.successfulDays++;
            console.log(`✓ Successfully downloaded data for ${dateStr}`);
          } else {
            bulkData.summary.failedDays++;
            console.log(`⚠ Partial data downloaded for ${dateStr} (${dayData.errors.length} errors)`);
          }
        } catch (error) {
          bulkData.summary.failedDays++;
          console.error(`✗ Failed to download data for ${dateStr}:`, error.message);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Rate limiting between days
        await this.sleep(1000);
      }

      // Save bulk data to file
      const fileName = `garmin_bulk_${bulkData.startDate}_to_${bulkData.endDate}.json`;
      await this.saveToDisk(bulkData, fileName);
      
      console.log('\n========================================');
      console.log('Bulk Download Complete');
      console.log('========================================');
      console.log(`Total Days: ${bulkData.summary.totalDays}`);
      console.log(`Successful: ${bulkData.summary.successfulDays}`);
      console.log(`Failed: ${bulkData.summary.failedDays}`);
      console.log(`Data saved to: ${fileName}`);
      
      return bulkData;
    } catch (error) {
      console.error('Bulk download failed:', error.message);
      throw error;
    }
  }

  async downloadAllData(date) {
    if (!this.isAuthenticated) throw new Error('Not authenticated. Please login first.');
    
    const formattedDate = this.formatDate(date);
    
    const allData = {
      date: formattedDate,
      profile: null,
      dailySummary: null,
      heartRate: null,
      sleep: null,
      stress: null,
      activities: null,
      downloadedAt: new Date().toISOString(),
      errors: []
    };

    try {
      allData.profile = await this.getUserProfile();
      await this.sleep(500);
      
      allData.dailySummary = await this.getDailySummary(formattedDate);
      await this.sleep(500);
      
      allData.heartRate = await this.getHeartRateData(formattedDate);
      await this.sleep(500);
      
      allData.sleep = await this.getSleepData(formattedDate);
      await this.sleep(500);
      
      allData.stress = await this.getStressData(formattedDate);
      await this.sleep(500);
      
      allData.activities = await this.getActivityData();

      const fileName = `garmin_data_${formattedDate}.json`;
      await this.saveToDisk(allData, fileName);
      
      console.log(`\n✓ All data saved to ${fileName}`);
      return allData;
    } catch (error) {
      allData.errors.push(error.message);
      console.error('Error downloading all data:', error.message);
      
      // Save partial data even if some calls failed
      const fileName = `garmin_data_${formattedDate}_partial.json`;
      await this.saveToDisk(allData, fileName);
      console.log(`⚠ Partial data saved to ${fileName}`);
      
      throw error;
    }
  }

  async saveToDisk(data, fileName) {
    try {
      const filePath = path.join(__dirname, fileName);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return filePath;
    } catch (error) {
      console.error(`Error saving file ${fileName}:`, error.message);
      throw new Error(`Failed to save data: ${error.message}`);
    }
  }
}

// Usage Example with comprehensive error handling
async function main() {
  const downloader = new GarminDataDownloader();
  
  try {
    // Load credentials from environment variables (recommended) or hardcode
    const username = process.env.GARMIN_USERNAME || 'your_garmin_email@example.com';
    const password = process.env.GARMIN_PASSWORD || 'your_garmin_password';
    
    if (username === 'your_garmin_email@example.com') {
      console.error('\n⚠ ERROR: Please set your Garmin credentials!');
      console.log('\nOption 1 - Use environment variables (recommended):');
      console.log('  export GARMIN_USERNAME="your_email@example.com"');
      console.log('  export GARMIN_PASSWORD="your_password"');
      console.log('\nOption 2 - Edit the code and replace the placeholder credentials\n');
      process.exit(1);
    }
    
    // Login
    await downloader.login(username, password);
    
    // Choose one of the following options:
    
    // OPTION 1: Download single day (today)
    const today = new Date().toISOString().split('T')[0];
    await downloader.downloadAllData(today);
    
    // OPTION 2: Download bulk historical data (last 7 days)
    // const endDate = new Date();
    // const startDate = new Date();
    // startDate.setDate(startDate.getDate() - 7);
    // await downloader.downloadBulkData(startDate, endDate);
    
    // OPTION 3: Download bulk data for specific date range
    // await downloader.downloadBulkData('2024-01-01', '2024-01-31');
    
    console.log('\n✓ Download completed successfully!');
    
  } catch (error) {
    console.error('\n✗ Download failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('credentials')) {
      console.log('\nTroubleshooting: Check your username and password');
    } else if (error.message.includes('2FA') || error.message.includes('MFA')) {
      console.log('\nTroubleshooting: Disable 2FA on your Garmin account or use OAuth API');
    } else if (error.message.includes('network')) {
      console.log('\nTroubleshooting: Check your internet connection');
    } else if (error.message.includes('authenticated')) {
      console.log('\nTroubleshooting: Login failed, verify credentials');
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = GarminDataDownloader;
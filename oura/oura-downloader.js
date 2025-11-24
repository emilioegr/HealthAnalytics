const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class OuraDataDownloader {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://api.ouraring.com/v2/usercollection';
    this.retryAttempts = 3;
    this.retryDelay = 2000;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
  }

  static async loadToken(filePath = 'oura-token.txt') {
    try {
      const tokenPath = path.join(__dirname, filePath);
      const token = await fs.readFile(tokenPath, 'utf8');
      return token.trim();
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Token file not found: ${filePath}. Please create this file with your Oura access token.`);
      }
      throw new Error(`Error reading token file: ${error.message}`);
    }
  }

  static async createTokenFile(filePath = 'oura-token.txt') {
    const tokenPath = path.join(__dirname, filePath);
    const template = `# Oura Personal Access Token
# Get your token from: https://cloud.ouraring.com/personal-access-tokens
# Replace the line below with your actual token (remove the # and YOUR_TOKEN_HERE)
# YOUR_TOKEN_HERE`;
    
    try {
      await fs.writeFile(tokenPath, template);
      console.log(`✓ Created token file template: ${tokenPath}`);
      console.log('Please edit this file and add your Oura access token.');
      return tokenPath;
    } catch (error) {
      throw new Error(`Failed to create token file: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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

  async getPersonalInfo() {
    try {
      console.log('\n=== Personal Information ===');
      const response = await this.retryOperation(
        () => this.client.get('/personal_info'),
        'Get Personal Info'
      );
      
      const info = response.data;
      console.log(`Age: ${info.age || 'N/A'}`);
      console.log(`Weight: ${info.weight || 'N/A'} kg`);
      console.log(`Height: ${info.height || 'N/A'} cm`);
      console.log(`Biological Sex: ${info.biological_sex || 'N/A'}`);
      console.log(`Email: ${info.email || 'N/A'}`);
      
      return info;
    } catch (error) {
      console.error('Error fetching personal info:', error.message);
      return null;
    }
  }

  async getDailySleep(startDate, endDate) {
    try {
      console.log(`\n=== Sleep Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/daily_sleep', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Daily Sleep'
      );
      
      const sleepData = response.data.data;
      console.log(`Found ${sleepData.length} sleep records`);
      
      return sleepData;
    } catch (error) {
      console.error('Error fetching sleep data:', error.message);
      return [];
    }
  }

  async getDailyActivity(startDate, endDate) {
    try {
      console.log(`\n=== Activity Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/daily_activity', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Daily Activity'
      );
      
      const activityData = response.data.data;
      console.log(`Found ${activityData.length} activity records`);
      
      return activityData;
    } catch (error) {
      console.error('Error fetching activity data:', error.message);
      return [];
    }
  }

  async getDailyReadiness(startDate, endDate) {
    try {
      console.log(`\n=== Readiness Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/daily_readiness', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Daily Readiness'
      );
      
      const readinessData = response.data.data;
      console.log(`Found ${readinessData.length} readiness records`);
      
      return readinessData;
    } catch (error) {
      console.error('Error fetching readiness data:', error.message);
      return [];
    }
  }

  async getHeartRate(startDate, endDate) {
    try {
      console.log(`\n=== Heart Rate Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/heartrate', {
          params: { start_datetime: `${startDate}T00:00:00`, end_datetime: `${endDate}T23:59:59` }
        }),
        'Get Heart Rate'
      );
      
      const hrData = response.data.data;
      console.log(`Found ${hrData.length} heart rate records`);
      
      return hrData;
    } catch (error) {
      console.error('Error fetching heart rate data:', error.message);
      return [];
    }
  }

  async getWorkouts(startDate, endDate) {
    try {
      console.log(`\n=== Workout Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/workout', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Workouts'
      );
      
      const workouts = response.data.data;
      console.log(`Found ${workouts.length} workouts`);
      
      return workouts;
    } catch (error) {
      console.error('Error fetching workouts:', error.message);
      return [];
    }
  }

  async getSessions(startDate, endDate) {
    try {
      console.log(`\n=== Session Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/session', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Sessions'
      );
      
      const sessions = response.data.data;
      console.log(`Found ${sessions.length} sessions`);
      
      return sessions;
    } catch (error) {
      console.error('Error fetching sessions:', error.message);
      return [];
    }
  }

  async getTags(startDate, endDate) {
    try {
      console.log(`\n=== Tags Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/tag', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Tags'
      );
      
      const tags = response.data.data;
      console.log(`Found ${tags.length} tags`);
      
      return tags;
    } catch (error) {
      console.error('Error fetching tags:', error.message);
      return [];
    }
  }

  async getRestModePeriod(startDate, endDate) {
    try {
      console.log(`\n=== Rest Mode Data (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/rest_mode_period', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Rest Mode Period'
      );
      
      const restMode = response.data.data;
      console.log(`Found ${restMode.length} rest mode periods`);
      
      return restMode;
    } catch (error) {
      console.error('Error fetching rest mode data:', error.message);
      return [];
    }
  }

  async getRingConfiguration(startDate, endDate) {
    try {
      console.log(`\n=== Ring Configuration (${startDate} to ${endDate}) ===`);
      const response = await this.retryOperation(
        () => this.client.get('/ring_configuration', {
          params: { start_date: startDate, end_date: endDate }
        }),
        'Get Ring Configuration'
      );
      
      const config = response.data.data;
      console.log(`Found ${config.length} ring configurations`);
      
      return config;
    } catch (error) {
      console.error('Error fetching ring configuration:', error.message);
      return [];
    }
  }

  formatDate(date) {
    if (!date) return new Date().toISOString().split('T')[0];
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return new Date(date).toISOString().split('T')[0];
  }

  async downloadBulkData(startDate, endDate) {
    console.log('\n========================================');
    console.log('Starting Oura Bulk Data Download');
    console.log('========================================\n');
    
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    
    const bulkData = {
      startDate: start,
      endDate: end,
      personalInfo: null,
      sleep: [],
      activity: [],
      readiness: [],
      heartRate: [],
      workouts: [],
      sessions: [],
      tags: [],
      restMode: [],
      ringConfiguration: [],
      downloadedAt: new Date().toISOString(),
      errors: []
    };

    try {
      // Get personal info once
      bulkData.personalInfo = await this.getPersonalInfo();
      await this.sleep(500);
      
      // Get all daily data
      bulkData.sleep = await this.getDailySleep(start, end);
      await this.sleep(500);
      
      bulkData.activity = await this.getDailyActivity(start, end);
      await this.sleep(500);
      
      bulkData.readiness = await this.getDailyReadiness(start, end);
      await this.sleep(500);
      
      // Get heart rate data (can be large)
      bulkData.heartRate = await this.getHeartRate(start, end);
      await this.sleep(500);
      
      // Get workouts
      bulkData.workouts = await this.getWorkouts(start, end);
      await this.sleep(500);
      
      // Get sessions
      bulkData.sessions = await this.getSessions(start, end);
      await this.sleep(500);
      
      // Get tags
      bulkData.tags = await this.getTags(start, end);
      await this.sleep(500);
      
      // Get rest mode periods
      bulkData.restMode = await this.getRestModePeriod(start, end);
      await this.sleep(500);
      
      // Get ring configuration
      bulkData.ringConfiguration = await this.getRingConfiguration(start, end);

      // Save bulk data to file
      const fileName = `oura_bulk_${bulkData.startDate}_to_${bulkData.endDate}.json`;
      await this.saveToDisk(bulkData, fileName);
      
      console.log('\n========================================');
      console.log('Bulk Download Complete');
      console.log('========================================');
      console.log(`Sleep records: ${bulkData.sleep.length}`);
      console.log(`Activity records: ${bulkData.activity.length}`);
      console.log(`Readiness records: ${bulkData.readiness.length}`);
      console.log(`Heart rate records: ${bulkData.heartRate.length}`);
      console.log(`Workouts: ${bulkData.workouts.length}`);
      console.log(`Sessions: ${bulkData.sessions.length}`);
      console.log(`Data saved to: ${fileName}`);
      
      return bulkData;
    } catch (error) {
      console.error('Bulk download failed:', error.message);
      bulkData.errors.push(error.message);
      
      // Save partial data
      const fileName = `oura_bulk_${bulkData.startDate}_to_${bulkData.endDate}_partial.json`;
      await this.saveToDisk(bulkData, fileName);
      console.log(`⚠ Partial data saved to ${fileName}`);
      
      throw error;
    }
  }

  async downloadDayData(date) {
    const formattedDate = this.formatDate(date);
    
    console.log(`\n--- Downloading Oura data for ${formattedDate} ---`);
    
    const dayData = {
      date: formattedDate,
      personalInfo: null,
      sleep: [],
      activity: [],
      readiness: [],
      heartRate: [],
      workouts: [],
      sessions: [],
      tags: [],
      downloadedAt: new Date().toISOString(),
      errors: []
    };

    try {
      dayData.personalInfo = await this.getPersonalInfo();
      await this.sleep(500);
      
      dayData.sleep = await this.getDailySleep(formattedDate, formattedDate);
      await this.sleep(500);
      
      dayData.activity = await this.getDailyActivity(formattedDate, formattedDate);
      await this.sleep(500);
      
      dayData.readiness = await this.getDailyReadiness(formattedDate, formattedDate);
      await this.sleep(500);
      
      dayData.heartRate = await this.getHeartRate(formattedDate, formattedDate);
      await this.sleep(500);
      
      dayData.workouts = await this.getWorkouts(formattedDate, formattedDate);
      await this.sleep(500);
      
      dayData.sessions = await this.getSessions(formattedDate, formattedDate);
      await this.sleep(500);
      
      dayData.tags = await this.getTags(formattedDate, formattedDate);

      const fileName = `oura_data_${formattedDate}.json`;
      await this.saveToDisk(dayData, fileName);
      
      console.log(`✓ Data saved to ${fileName}`);
      return dayData;
    } catch (error) {
      dayData.errors.push(error.message);
      console.error(`Error downloading data for ${formattedDate}:`, error.message);
      
      const fileName = `oura_data_${formattedDate}_partial.json`;
      await this.saveToDisk(dayData, fileName);
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

// Usage Example
async function main() {
  try {
    const tokenFile = 'oura-token.txt';
    
    // Check if token file exists, if not create template
    let accessToken;
    try {
      accessToken = await OuraDataDownloader.loadToken(tokenFile);
      
      // Validate token is not placeholder
      if (accessToken.includes('YOUR_TOKEN_HERE') || accessToken.startsWith('#')) {
        throw new Error('Token file contains placeholder text');
      }
    } catch (error) {
      if (error.message.includes('not found')) {
        console.log('Token file not found. Creating template...');
        await OuraDataDownloader.createTokenFile(tokenFile);
      }
      
      console.error('\n⚠ ERROR: Please configure your Oura access token!');
      console.log('\nSteps:');
      console.log('1. Visit: https://cloud.ouraring.com/personal-access-tokens');
      console.log('2. Create a new Personal Access Token');
      console.log(`3. Edit the file "${tokenFile}" and paste your token`);
      console.log('4. Run this script again\n');
      process.exit(1);
    }
    
    console.log('✓ Token loaded successfully');
    const downloader = new OuraDataDownloader(accessToken);
    
    // Choose one of the following options:
    
    // OPTION 1: Download single day (today)
    const today = new Date().toISOString().split('T')[0];
    await downloader.downloadDayData(today);
    
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
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || 'Unknown error'}`);
      
      if (error.response.status === 401) {
        console.log('\nTroubleshooting: Invalid access token. Please check your token in oura-token.txt');
      } else if (error.response.status === 429) {
        console.log('\nTroubleshooting: Rate limit exceeded. Please wait and try again.');
      }
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = OuraDataDownloader;
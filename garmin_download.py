#!/usr/bin/env python3
"""
Garmin Data Downloader with 2FA Support
Downloads health data for a specific date or date range
"""

import sys
import json
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from getpass import getpass

try:
    import garth
except ImportError:
    print("\n❌ Error: 'garth' library not found.")
    print("\nPlease install it using:")
    print("  pip install garth")
    print("  or")
    print("  pip3 install garth\n")
    sys.exit(1)


class GarminDataDownloader:
    def __init__(self):
        self.token_dir = Path.home() / ".garth"
        self.authenticated = False
    
    def login(self, email=None, password=None):
        """Login to Garmin Connect with optional 2FA support"""
        try:
            # Try to resume existing session
            if self.token_dir.exists():
                print("Attempting to use saved tokens...")
                garth.resume(str(self.token_dir))
                garth.client.username  # Test the connection
                print("✓ Authenticated using saved tokens")
                self.authenticated = True
                return True
        except Exception:
            print("⚠ Saved tokens not found or expired")
        
        # Need fresh login
        if not email:
            email = input("Enter your Garmin email: ")
        if not password:
            password = getpass("Enter your Garmin password: ")
        
        print("\nAttempting to login...")
        
        try:
            garth.login(email, password)
            print("✓ Login successful!")
            
            # Save tokens
            self.token_dir.mkdir(exist_ok=True)
            garth.save(str(self.token_dir))
            print(f"✓ Tokens saved to: {self.token_dir}")
            
            self.authenticated = True
            return True
            
        except Exception as e:
            if "MFA" in str(e) or "token" in str(e).lower():
                print("\n⚠ 2FA/MFA required")
                mfa_code = input("Enter your 2FA code: ")
                
                try:
                    garth.login(email, password, prompt_mfa=lambda: mfa_code)
                    
                    # Save tokens
                    self.token_dir.mkdir(exist_ok=True)
                    garth.save(str(self.token_dir))
                    
                    print("✓ Login successful with MFA!")
                    self.authenticated = True
                    return True
                except Exception as mfa_error:
                    print(f"✗ MFA Error: {mfa_error}")
                    return False
            else:
                print(f"✗ Login Error: {e}")
                return False
    
    def get_daily_summary(self, date_str):
        """Get daily summary for a specific date"""
        if not self.authenticated:
            raise Exception("Not authenticated")
        
        try:
            # Format: YYYY-MM-DD
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            
            # Validate date is not in the future
            if date_obj > datetime.now():
                print(f"⚠ Warning: Date {date_str} is in the future. Using today's date instead.")
                date_str = datetime.now().strftime("%Y-%m-%d")
            
            # Get daily stats using the correct endpoint
            stats = garth.connectapi(
                f"/usersummary-service/usersummary/daily/{garth.client.username}",
                params={"calendarDate": date_str}
            )
            
            summary = {
                "date": date_str,
                "steps": stats.get("totalSteps"),
                "calories": stats.get("totalKilocalories") or stats.get("activeKilocalories"),
                "distance_meters": stats.get("totalDistanceMeters"),
                "active_seconds": stats.get("activeTimeInSeconds") or stats.get("highlyActiveSeconds"),
                "floors_climbed": stats.get("floorsClimbed"),
                "moderate_intensity_minutes": stats.get("moderateIntensityMinutes"),
                "vigorous_intensity_minutes": stats.get("vigorousIntensityMinutes"),
            }
            
            print(f"\n=== Daily Summary for {date_str} ===")
            print(f"Steps: {summary['steps'] or 'N/A'}")
            print(f"Calories: {summary['calories'] or 'N/A'}")
            print(f"Distance: {(summary['distance_meters']/1000):.2f} km" if summary['distance_meters'] else "N/A")
            print(f"Active Time: {(summary['active_seconds']/60):.0f} min" if summary['active_seconds'] else "N/A")
            
            return summary
        except Exception as e:
            print(f"Error fetching daily summary: {e}")
            return None
    
    def get_heart_rate(self, date_str):
        """Get heart rate data for a specific date"""
        if not self.authenticated:
            raise Exception("Not authenticated")
        
        try:
            # Validate date is not in the future
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            if date_obj > datetime.now():
                date_str = datetime.now().strftime("%Y-%m-%d")
            
            # Get heart rate data
            hr_data = garth.connectapi(f"/wellness-service/wellness/dailyHeartRate/{garth.client.username}/{date_str}")
            
            heart_rate = {
                "date": date_str,
                "resting_hr": hr_data.get("restingHeartRate"),
                "max_hr": hr_data.get("maxHeartRate"),
                "min_hr": hr_data.get("minHeartRate"),
                "avg_hr": hr_data.get("averageHeartRate") or hr_data.get("currentDayRestingHeartRate"),
            }
            
            print(f"\n=== Heart Rate for {date_str} ===")
            print(f"Resting: {heart_rate['resting_hr'] or 'N/A'} bpm")
            print(f"Max: {heart_rate['max_hr'] or 'N/A'} bpm")
            print(f"Min: {heart_rate['min_hr'] or 'N/A'} bpm")
            
            return heart_rate
        except Exception as e:
            print(f"Error fetching heart rate: {e}")
            return None
    
    def get_sleep_data(self, date_str):
        """Get sleep data for a specific date"""
        if not self.authenticated:
            raise Exception("Not authenticated")
        
        try:
            # Validate date is not in the future
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            if date_obj > datetime.now():
                date_str = datetime.now().strftime("%Y-%m-%d")
            
            # Get sleep data - try different endpoint formats
            try:
                sleep_data = garth.connectapi(f"/wellness-service/wellness/dailySleepData/{garth.client.username}?date={date_str}")
            except:
                # Alternative endpoint
                sleep_data = garth.connectapi(f"/wellness-service/wellness/dailySleepData/{garth.client.username}/{date_str}")
            
            daily_sleep = sleep_data.get("dailySleepDTO") if isinstance(sleep_data, dict) else {}
            
            sleep = {
                "date": date_str,
                "total_sleep_seconds": daily_sleep.get("sleepTimeSeconds"),
                "deep_sleep_seconds": daily_sleep.get("deepSleepSeconds"),
                "light_sleep_seconds": daily_sleep.get("lightSleepSeconds"),
                "rem_sleep_seconds": daily_sleep.get("remSleepSeconds"),
                "awake_seconds": daily_sleep.get("awakeSleepSeconds"),
            }
            
            print(f"\n=== Sleep Data for {date_str} ===")
            if sleep['total_sleep_seconds']:
                print(f"Total Sleep: {(sleep['total_sleep_seconds']/3600):.2f} hours")
                print(f"Deep Sleep: {(sleep['deep_sleep_seconds']/3600):.2f} hours" if sleep['deep_sleep_seconds'] else "N/A")
                print(f"Light Sleep: {(sleep['light_sleep_seconds']/3600):.2f} hours" if sleep['light_sleep_seconds'] else "N/A")
                print(f"REM Sleep: {(sleep['rem_sleep_seconds']/3600):.2f} hours" if sleep['rem_sleep_seconds'] else "N/A")
            else:
                print("No sleep data available")
            
            return sleep
        except Exception as e:
            print(f"Error fetching sleep data: {e}")
            return None
    
    def get_stress_data(self, date_str):
        """Get stress data for a specific date"""
        if not self.authenticated:
            raise Exception("Not authenticated")
        
        try:
            # Validate date is not in the future
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            if date_obj > datetime.now():
                date_str = datetime.now().strftime("%Y-%m-%d")
            
            # Get stress data
            stress_data = garth.connectapi(f"/wellness-service/wellness/dailyStress/{date_str}")
            
            stress = {
                "date": date_str,
                "avg_stress": stress_data.get("avgStressLevel") or stress_data.get("overallStressLevel"),
                "max_stress": stress_data.get("maxStressLevel"),
            }
            
            print(f"\n=== Stress Data for {date_str} ===")
            print(f"Average Stress: {stress['avg_stress'] or 'N/A'}")
            print(f"Max Stress: {stress['max_stress'] or 'N/A'}")
            
            return stress
        except Exception as e:
            print(f"Error fetching stress data: {e}")
            return None
    
    def download_day_data(self, date_str):
        """Download all data for a specific date"""
        print(f"\n📊 Downloading data for {date_str}...")
        
        data = {
            "date": date_str,
            "daily_summary": self.get_daily_summary(date_str),
            "heart_rate": self.get_heart_rate(date_str),
            "sleep": self.get_sleep_data(date_str),
            "stress": self.get_stress_data(date_str),
            "downloaded_at": datetime.now().isoformat(),
        }
        
        # Save to file
        filename = f"garmin_data_{date_str}.json"
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\n✓ Data saved to: {filename}")
        return data


def main():
    parser = argparse.ArgumentParser(description="Download Garmin Connect health data")
    parser.add_argument("--date", help="Download data for specific date (YYYY-MM-DD). Default: today")
    parser.add_argument("--yesterday", action="store_true", help="Download yesterday's data")
    parser.add_argument("--email", help="Garmin email (optional)")
    parser.add_argument("--password", help="Garmin password (optional, not recommended)")
    
    args = parser.parse_args()
    
    # Determine date to download
    if args.yesterday:
        target_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    elif args.date:
        target_date = args.date
    else:
        target_date = datetime.now().strftime("%Y-%m-%d")
    
    print("=" * 60)
    print("Garmin Data Downloader")
    print("=" * 60)
    
    downloader = GarminDataDownloader()
    
    # Login
    if not downloader.login(args.email, args.password):
        print("\n✗ Login failed!")
        sys.exit(1)
    
    # Download data
    try:
        downloader.download_day_data(target_date)
        print("\n✓ Download completed successfully!")
    except Exception as e:
        print(f"\n✗ Download failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
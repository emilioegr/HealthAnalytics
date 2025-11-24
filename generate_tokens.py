#!/usr/bin/env python3
"""
Garmin Connect 2FA Token Generator
This script generates OAuth tokens that can be used with 2FA-enabled accounts.
Tokens are valid for about 1 year and can be reused without entering 2FA codes.
"""

import garth
from getpass import getpass
import json
import os
from pathlib import Path

def setup_garmin_tokens():
    """
    Generate and save Garmin Connect OAuth tokens with 2FA support.
    Tokens will be saved to ~/.garth/ directory.
    """
    print("=" * 60)
    print("Garmin Connect 2FA Token Generator")
    print("=" * 60)
    print("\nThis will generate OAuth tokens for your Garmin account.")
    print("If you have 2FA enabled, you'll be prompted for the code.\n")
    
    # Get credentials
    email = input("Enter your Garmin email: ")
    password = getpass("Enter your Garmin password: ")
    
    print("\nAttempting to login...")
    
    try:
        # Login with MFA support
        # If MFA is required, garth will prompt for the code automatically
        garth.login(email, password)
        
        print("✓ Login successful!")
        
        # Save tokens to default location (~/.garth)
        token_dir = Path.home() / ".garth"
        garth.save(str(token_dir))
        
        print(f"\n✓ Tokens saved to: {token_dir}")
        print("\nToken files created:")
        print(f"  - {token_dir}/oauth1_token.json")
        print(f"  - {token_dir}/oauth2_token.json")
        
        # Also save to a JSON file for Node.js usage
        tokens = {
            "oauth1": garth.client.oauth1_token.__dict__ if garth.client.oauth1_token else None,
            "oauth2": garth.client.oauth2_token.__dict__ if garth.client.oauth2_token else None,
        }
        
        node_token_file = Path.cwd() / "garmin_tokens.json"
        with open(node_token_file, 'w') as f:
            json.dump(tokens, f, indent=2, default=str)
        
        print(f"\n✓ Tokens also saved for Node.js: {node_token_file}")
        print("\nThese tokens are valid for about 1 year.")
        print("You can now use them in your Node.js application without 2FA prompts!")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nTroubleshooting:")
        print("  - Check your email and password")
        print("  - If you have 2FA, make sure you enter the code when prompted")
        print("  - Check your internet connection")
        return False

def verify_tokens():
    """Verify that the saved tokens are working."""
    try:
        token_dir = Path.home() / ".garth"
        garth.resume(str(token_dir))
        
        # Test the connection
        username = garth.client.username
        print(f"\n✓ Tokens verified! Logged in as: {username}")
        return True
    except Exception as e:
        print(f"\n✗ Token verification failed: {e}")
        return False

if __name__ == "__main__":
    # Install instructions
    print("\nPrerequisites:")
    print("  pip install garth")
    print("\n" + "=" * 60 + "\n")
    
    success = setup_garmin_tokens()
    
    if success:
        print("\n" + "=" * 60)
        print("Next Steps:")
        print("=" * 60)
        print("\n1. Copy the garmin_tokens.json file to your Node.js project")
        print("2. Update your Node.js script to use these tokens")
        print("3. Tokens will auto-refresh and don't expire for ~1 year")
        print("\nRun this script again if tokens expire or you need to refresh them.\n")
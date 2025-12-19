# Gym Pilates Auto-Booking System

Automated booking system for Saturday Pilates classes (08:30-09:25) at Sportcentrum De Trits.

## How It Works

1. GitHub Actions triggers every Saturday at 23:55 CET
2. Script waits until exactly midnight (00:00:00 CET)
3. Logs into the gym's booking system
4. Navigates to next week's Saturday
5. Finds the Pilates class (08:30-09:25)
6. Clicks to open the modal
7. Clicks the "Inschrijven" (subscribe) button
8. Takes screenshots for verification

## Setup Instructions

### 1. Local Testing (Optional but Recommended)

First, test the script locally to ensure it works with your credentials:

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Create a .env file with your credentials (this file is gitignored)
echo "GYM_EMAIL=your-email@example.com" > .env
echo "GYM_PASSWORD=your-password" >> .env

# Run in test mode (skips midnight wait, shows browser)
npm run test
```

### 2. GitHub Setup

1. **Create a GitHub repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Gym booking automation"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bookfast.git
   git push -u origin main
   ```

2. **Add GitHub Secrets**
   - Go to your repository on GitHub
   - Click `Settings` → `Secrets and variables` → `Actions`
   - Click `New repository secret`
   - Add two secrets:
     - Name: `GYM_EMAIL`, Value: your gym email
     - Name: `GYM_PASSWORD`, Value: your gym password

3. **Enable GitHub Actions**
   - Go to the `Actions` tab in your repository
   - Click `I understand my workflows, go ahead and enable them`

### 3. Test the Workflow

Trigger the workflow manually to test:

1. Go to `Actions` tab
2. Click on `Book Pilates Class` workflow
3. Click `Run workflow` → `Run workflow`
4. Wait for it to complete
5. Download the screenshots artifact to verify

### 4. Production

The workflow will automatically run every Saturday at 23:55 CET and book the class at midnight.

## File Structure

```
bookfast/
├── src/
│   └── book.js              # Main booking script
├── .github/
│   └── workflows/
│       └── book-pilates.yml # GitHub Actions workflow
├── package.json             # Dependencies
├── playwright.config.js     # Playwright configuration
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Troubleshooting

### Check the screenshots

After each run, GitHub Actions uploads screenshots:
1. Go to the workflow run
2. Scroll to the bottom
3. Download the `booking-screenshots-XXX` artifact
4. Extract and review the PNG files

### Common Issues

**Login fails:**
- Check that `GYM_EMAIL` and `GYM_PASSWORD` secrets are correct
- Verify the login URL hasn't changed

**Can't find Pilates class:**
- Check the screenshot `step2-next-week.png`
- Verify the class is scheduled for that Saturday
- The class name/time might have changed

**Subscribe button not found:**
- The class might be full
- Check `step3-modal-open.png` for details

### Manual Intervention

If the automation fails, you can always book manually at midnight.

## Timezone Notes

- The script uses `Europe/Amsterdam` timezone (CET/CEST)
- CET (winter): UTC+1
- CEST (summer): UTC+2
- GitHub Actions runs at 22:55 UTC, which is 23:55 CET (winter)
- In summer (CEST), it runs at 00:55 CEST, but the script waits until the next midnight

## Security

- Credentials are stored as encrypted GitHub Secrets
- Never commit `.env` file to git
- Screenshots are stored for 30 days and then automatically deleted

## Customization

To book a different class:

1. Edit `src/book.js`
2. Change the `pilatesBlock` filter:
   ```javascript
   const pilatesBlock = page.locator('[wire\\:click*="showLessonModal"]')
     .filter({ hasText: 'YOUR_CLASS_NAME' })
     .filter({ hasText: 'YOUR_TIME' });
   ```

To change the schedule:

1. Edit `.github/workflows/book-pilates.yml`
2. Modify the cron expression:
   ```yaml
   - cron: '55 22 * * 6'  # Saturday at 22:55 UTC
   ```

## License

MIT

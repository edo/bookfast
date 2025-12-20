# Bookfast - Multi-Class Gym Booking System

Automated booking system for gym classes at Sportcentrum De Trits with a user-friendly web interface.

## Features

- 📅 **Multi-class support**: Book multiple classes across different days of the week
- 🌐 **Web interface**: User-friendly GUI to manage class configurations
- 🔄 **Automatic retry**: Configurable retry logic for failed bookings
- 📸 **Screenshots**: Automatic screenshots for debugging
- ⚙️ **Daily automation**: Runs daily and books classes 7 days in advance

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/bookfast.git
cd bookfast
npm install
npx playwright install chromium
```

### 2. Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, and add:

- `GYM_EMAIL`: Your gym account email
- `GYM_PASSWORD`: Your gym account password

### 3. Set Up the Web Interface

1. Enable GitHub Pages:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main`, Folder: `/docs`
   - Click Save

2. Visit your GitHub Pages URL:
   - `https://YOUR_USERNAME.github.io/bookfast/`

3. Generate a Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `repo` scope
   - Copy the token

4. Configure classes via the web interface:
   - Enter your GitHub token
   - Enter repository name (e.g., `username/bookfast`)
   - Add your classes with day, time, and preferences
   - Save configuration

### 4. Test the System

```bash
# Local test (skips midnight wait)
npm run test

# Or trigger workflow manually via GitHub Actions
```

## Web Interface

The web interface allows your girlfriend to manage class bookings without touching code:

### Features
- ✅ Add/Edit/Delete classes
- ✅ Enable/Disable classes with a toggle
- ✅ Configure retry settings per class
- ✅ Trigger workflows manually
- ✅ View logs and screenshots

### Usage
1. Visit your GitHub Pages URL
2. Authenticate with your GitHub token
3. Add classes using the form:
   - Class name (e.g., "Pilates")
   - Day of week (e.g., "Zaterdag")
   - Time slot (e.g., "08:30")
4. Click Save - changes are committed to the repository
5. The system automatically books enabled classes

## How It Works

### Booking Flow

1. **Daily workflow runs** at 22:55 UTC (23:55 CET)
2. **Script waits** until exactly 00:00:10 CET
3. **Loads configuration** from `config/classes.json`
4. **Filters classes** for today's day of week
5. **For each class**:
   - Logs into gym website
   - Navigates to lessons page
   - Clicks "next week" to view classes 7 days ahead
   - Finds the correct day section (e.g., "zaterdag")
   - Finds the class by name and time within that day
   - Clicks the class to open modal
   - Clicks register button
   - Takes screenshots
   - Retries on failure (configurable)

### Configuration File

Classes are stored in `config/classes.json`:

```json
{
  "version": "1.0",
  "classes": [
    {
      "id": "pilates-sat-0830",
      "enabled": true,
      "className": "Pilates",
      "timeSlot": "08:30",
      "dayOfWeek": 6,
      "dayName": "zaterdag",
      "retryConfig": {
        "maxRetries": 3,
        "retryDelayMs": 5000
      },
      "description": "Saturday morning Pilates class"
    }
  ],
  "globalSettings": {
    "timezone": "Europe/Amsterdam",
    "bookingStartTime": "00:00:10"
  }
}
```

## File Structure

```
bookfast/
├── config/
│   └── classes.json                # Class configurations
├── src/
│   ├── book.js                     # Main entry point
│   └── lib/
│       ├── config-loader.js        # Load/parse config
│       ├── booking-engine.js       # Core booking logic
│       ├── scheduler.js            # Midnight wait logic
│       └── retry-handler.js        # Retry logic
├── docs/
│   ├── index.html                  # Web interface
│   ├── css/
│   │   └── styles.css              # Styling
│   └── js/
│       ├── app.js                  # Main app logic
│       ├── github-api.js           # GitHub API client
│       └── validation.js           # Form validation
├── .github/
│   └── workflows/
│       └── book-classes.yml        # Daily workflow
├── package.json                    # Dependencies
├── playwright.config.js            # Playwright settings
└── README.md                       # This file
```

## Local Testing

### Test with configuration file

```bash
# Test all classes configured for today
npm run test

# Test a specific class by ID
node src/book.js --test --class=pilates-sat-0830
```

### Test workflow manually

1. Go to GitHub Actions tab
2. Click "Book Gym Classes" workflow
3. Click "Run workflow"
4. Download screenshots from artifacts

## Troubleshooting

### Check Screenshots

After each run, screenshots are uploaded to GitHub Actions:
1. Go to the workflow run
2. Scroll to "Artifacts"
3. Download `booking-screenshots-XXX.zip`
4. Review PNG files:
   - `{id}-step1-lessons-page.png`: Initial lessons page
   - `{id}-step2-next-week.png`: After clicking "next week"
   - `{id}-step3-modal-open.png`: Modal with register button
   - `{id}-step4-after-register.png`: After clicking register
   - `{id}-booking-result.png`: Final result
   - `{id}-error-screenshot.png`: Error screenshot (if any)

### Common Issues

**Authentication fails:**
- Check GitHub Secrets (`GYM_EMAIL`, `GYM_PASSWORD`)
- Test locally with `.env` file

**Class not found:**
- Check `step2-next-week.png` screenshot
- Verify class name, day, and time in configuration
- Ensure class exists in gym's schedule

**Already registered:**
- System considers this a success
- Check workflow logs for details

**Class full:**
- Booking will fail (non-retryable)
- Check screenshots for confirmation

**Retry limit reached:**
- Check screenshots to diagnose issue
- Increase `maxRetries` in class configuration

### Debugging Tips

1. **Run locally in test mode**:
   ```bash
   npm run test
   ```
   This shows the browser and helps diagnose issues

2. **Check workflow logs**:
   - Go to Actions tab
   - Click on the failed run
   - Expand steps to see detailed logs

3. **Validate configuration**:
   - Ensure `config/classes.json` is valid JSON
   - Check day names are in Dutch lowercase
   - Verify time format is HH:MM

## Advanced Configuration

### Add a new class

Via web interface:
1. Click "Add Class"
2. Fill in class details
3. Click "Save Class"

Via manual edit:
1. Edit `config/classes.json`
2. Add new class object to `classes` array
3. Commit and push changes

### Disable a class temporarily

Via web interface:
- Toggle the switch next to the class

Via manual edit:
- Set `"enabled": false` in configuration

### Change retry behavior

Edit retry config for specific class:

```json
"retryConfig": {
  "maxRetries": 5,      // Increase retry count
  "retryDelayMs": 10000 // Increase delay (10 seconds)
}
```

### Change booking time

Edit global settings:

```json
"globalSettings": {
  "bookingStartTime": "00:00:05"  // Book at 5 seconds past midnight
}
```

## Timezone Information

- **Timezone**: `Europe/Amsterdam` (CET/CEST)
- **CET** (winter): UTC+1
- **CEST** (summer): UTC+2
- **Workflow runs**: Daily at 22:55 UTC
  - Winter: 23:55 CET (5 minutes before midnight)
  - Summer: 00:55 CEST (script waits for next midnight)
- **Booking time**: 00:00:10 CET (10 seconds past midnight)

## Security

- ✅ Credentials stored as encrypted GitHub Secrets
- ✅ Web interface uses Personal Access Token (stored in browser)
- ✅ `.env` file gitignored (never committed)
- ✅ Screenshots auto-deleted after 30 days
- ✅ Fine-grained access control via GitHub token scopes

## Contributing

Feel free to submit issues or pull requests to improve the system!

## License

MIT

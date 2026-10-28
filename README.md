# Droply 📦

**Share files and messages securely with secret codes. No account needed.**

## What is Droply?

Droply lets you share files and text with anyone using a secret code. Create a drop, upload files or add a message, set an expiration time, and share the code. Recipients can download everything with just the code.

### Features
- 📁 Upload any file type (images, PDFs, videos, documents, etc.)
- 💬 Add optional text messages
- 🔐 Secret code protection (you choose the code)
- ⏰ Auto-expiration (1 hour, 1 day, 7 days, 30 days, or custom)
- 📥 Download files with preview (images, videos, audio show inline)
- 🚫 Files automatically deleted after expiration
- ✅ No login required

## How to Run Droply

### What You Need
- **Node.js** - v20 or higher
- **MongoDB** - Local or cloud (Atlas)
- **Redis** - Local or cloud (Upstash)

### Quick Start

1. **Install dependencies:**
   ```sh
   npm install
   cd client && npm install && cd ..
   cd server && npm install && cd ..
   ```

2. **Setup environment file:**
   - Copy `.env.example` to `.env`
   - Add your MongoDB and Redis URLs
   - Keep the CODE_PEPPER and MANAGEMENT_PEPPER random strings (they're already set)

3. **Start your services:**
   - Make sure MongoDB is running
   - Make sure Redis is running

4. **Run Droply:**
   ```sh
   # Terminal 1 - Start the backend API
   npm --prefix server run dev

   # Terminal 2 - Start the frontend UI
   npm --prefix client run dev
   ```

5. **Open in browser:**
   ```
   http://localhost:5173
   ```

## Environment Setup (.env file)

Key settings you need:

| Setting | What It Is | Example |
|---------|-----------|---------|
| `MONGODB_URI` | Where files/drops are stored | `mongodb://127.0.0.1:27017/droply` |
| `REDIS_URL` | Queue system for cleanup jobs | `redis://localhost:6379` |
| `CODE_PEPPER` | Secret string for codes (already set) | Random 32+ character string |
| `MANAGEMENT_PEPPER` | Secret string for management (already set) | Random 32+ character string |
| `PORT` | Backend server port | `4000` |

## How to Use Droply

### Create a Drop
1. Click "Create a Drop"
2. Choose a secret code (you type it)
3. Either upload files OR type a message OR both
4. Choose when it expires
5. Click "Create Drop"
6. Share the code with others

### Download from a Drop
1. Click "Access Drop"
2. Enter the secret code
3. See all files and messages
4. Click "Download" to get any file
5. Files are shown as preview (images, videos, etc.)

## File Structure

```
Droply/
├── client/          Frontend (React + Vite)
│   └── src/
├── server/          Backend API (Express + Node.js)
│   └── src/
└── tests/           End-to-end tests
```

## Limits

- Max file size: 100 MB per file
- Max files per drop: 20 files
- Max total drop size: 500 MB
- Expiration: 1 hour to 30 days

## Troubleshooting

**Backend won't start?**
- Check MongoDB is running
- Check Redis is running
- Check `.env` file has correct URLs

**Files not uploading?**
- Make sure both frontend and backend are running
- Check browser console for errors
- Try refreshing the page

**Can't access drop after creating?**
- Make sure you have the correct secret code
- Check if the drop has expired
- Try refreshing the browser

## Technologies Used

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Express, Node.js
- **Database:** MongoDB
- **Queue:** Redis + BullMQ
- **File Storage:** In-memory (for development)

## Need Help?

- Check the browser console for error messages
- Make sure all 3 services are running (MongoDB, Redis, Node servers)
- Verify your `.env` file settings

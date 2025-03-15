# Musync

Musync is a cross-platform playlist management application that synchronizes music playlists across multiple streaming services. The application allows users to import, create, and manage playlists that automatically sync between connected music platforms, initially supporting Spotify and YouTube Music, with a distinctive retro interface inspired by CRT monitors and arcade games.

## Features

- **Cross-Platform Synchronization**: Automatically sync playlists between Spotify and YouTube Music
- **Playlist Management**: Import, create, edit, and delete playlists
- **User Authentication**: Login with email or OAuth via Spotify/Google
- **Unified Search**: Search for tracks across all connected platforms
- **Retro UI**: Distinctive interface with CRT monitor aesthetics

## Tech Stack

- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- MongoDB database
- Spotify Developer API credentials
- Google Developer API credentials

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Next Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# MongoDB
MONGODB_URI=your-mongodb-connection-string

# Spotify API
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret

# Google API
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/musync.git
   cd musync
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing

### Unit and Integration Tests

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Authentication Testing

Test the authentication functionality:

```bash
npm run test:auth
```

Note: The server must be running for this test to work.

### Manual Testing

1. Visit the test page at [http://localhost:3000/test](http://localhost:3000/test) to verify authentication and API functionality.
2. Use the login page at [http://localhost:3000/login](http://localhost:3000/login) to test authentication with email/password, Spotify, and Google.
3. Create, edit, and delete playlists at [http://localhost:3000/playlists](http://localhost:3000/playlists).
4. Import playlists from Spotify and YouTube from the playlist detail page.
5. Synchronize playlists across platforms from the playlist detail page.

## Project Structure

- `src/app`: Next.js app router pages and API routes
- `src/components`: Reusable React components
- `src/lib`: Utility functions, database connection, and models
- `src/styles`: Global styles
- `src/scripts`: Utility scripts
- `public`: Static assets

## API Routes

- `GET /api/playlists`: Get all playlists for the current user
- `POST /api/playlists`: Create a new playlist
- `GET /api/playlists/:id`: Get a specific playlist
- `PUT /api/playlists/:id`: Update a playlist
- `DELETE /api/playlists/:id`: Delete a playlist
- `POST /api/playlists/:id/sync`: Synchronize a playlist across platforms
- `GET /api/import/spotify`: Import playlists from Spotify
- `GET /api/import/youtube`: Import playlists from YouTube

## Deployment

The project is configured for easy deployment on Vercel:

### Deploying to Vercel

1. Push your code to a GitHub repository.
2. Visit [Vercel](https://vercel.com) and sign up or log in.
3. Click "New Project" and import your GitHub repository.
4. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: npm run build
   - Output Directory: .next

5. Add the following environment variables in the Vercel dashboard:
   - `MONGODB_URI`: Your MongoDB connection string
   - `NEXTAUTH_URL`: Your Vercel deployment URL (e.g., https://your-app.vercel.app)
   - `NEXTAUTH_SECRET`: A secure random string for NextAuth
   - `SPOTIFY_CLIENT_ID`: Your Spotify Developer API client ID
   - `SPOTIFY_CLIENT_SECRET`: Your Spotify Developer API client secret
   - `GOOGLE_CLIENT_ID`: Your Google Developer API client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google Developer API client secret

6. Click "Deploy" and wait for the deployment to complete.

### Important Notes for Deployment

1. Update your OAuth redirect URIs in the Spotify and Google Developer dashboards to include your Vercel deployment URL:
   - For Spotify: `https://your-app.vercel.app/api/auth/callback/spotify`
   - For Google: `https://your-app.vercel.app/api/auth/callback/google`

2. Make sure your MongoDB database is accessible from Vercel's servers. If you're using MongoDB Atlas, you may need to whitelist Vercel's IP addresses or allow access from anywhere.

3. After deployment, test the authentication and API functionality to ensure everything works correctly.

## License

This project is licensed under the ISC License. 
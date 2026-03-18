# TCM Obsidian Backend

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Environment:
   Create a `.env` file in the root of `back` directory:
   ```env
   MONGO_URI=mongodb://localhost:27017/tcm-obsidian
   JWT_SECRET=your_secret_key
   GEMINI_API_KEY=your_gemini_api_key
   PORT=3000
   ```

3. Run the server:
   ```bash
   npm run start
   ```

## Documentation

- **Swagger API Docs**: `http://localhost:3000/api`
- **Real-time**: Socket.io is enabled at `http://localhost:3000`. Connect to `EventsGateway`.

## API Endpoints

### Auth
- `POST /api/auth/register`: Register new user
- `POST /api/auth/login`: Login
- `GET /api/auth/me`: Get current user info

### Vaults
- `GET /api/vaults`: Get user's vaults
- `POST /api/vaults`: Create vault
- `GET /api/vaults/:id`: Get vault details
- `PATCH /api/vaults/:id`: Update vault
- `DELETE /api/vaults/:id`: Delete vault

### Files
- `GET /api/files/tree/:vaultId`: Get file tree
- `GET /api/files/:id`: Get file content
- `POST /api/files`: Create file/folder
- `PATCH /api/files/:id`: Update file
- `DELETE /api/files/:id`: Delete file

### User Data
- `GET /api/user/starred`: Get starred files
- `POST /api/user/star`: Toggle star
- `GET /api/user/highlights/:fileId`: Get highlights
- `POST /api/user/highlights`: Add highlight
- `GET /api/user/bookmarks`: Get bookmarks

### AI
- `POST /api/ai/chat`: Chat with Gemini AI

### Real-time Events (Socket.io)
- **Namespace**: `/`
- **Events**:
  - `joinVault`: Send `{ vaultId }` to join a vault room.
  - `leaveVault`: Send `{ vaultId }` to leave.
  - `collaborationSignal`: Relay cursor/selection updates.
  - `fileCreated`, `fileUpdated`, `fileDeleted`: Server broadcasts these events to the vault room.

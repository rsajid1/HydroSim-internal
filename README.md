# Frontend (Next.js)

This is the frontend client for the project, built using **Next.js** with **Tailwind CSS**, **shadcn ui**.  
It interacts with the FastAPI backend through API calls.

---

## Project Overview

- **Framework:** Next.js 14+  
- **Language:** TypeScript  
- **UI Library:** shadcn/ui  
- **Styling:** Tailwind CSS  
- **Server Port:** `3000`  
- **Environment File:** `.env.local`

---

## Folder Structure

````
frontend/
├── app/
│   ├── auth/
│   │   ├── login/
│   │   └── signup/
│   ├── layout.js
│   ├── page.js       ← Health check integrated here
│   └── globals.css
├── lib/
│   ├── api.js        ← API communication lives here
│   └── utils.js
├── public/
├── .env
├── package.json
└── README.md

````

---

## Requirements

- Node.js v20+
- npm or yarn package manager

---

## Setup Instructions

### 1. Navigate to the Frontend Directory
```bash
cd frontend
````

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Configuration

Create a `.env` file in the root of `/frontend`:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 4. Run the Development Server

```bash
npm run dev
```

App will run on:

```
http://localhost:3000
```

---

## Connecting to Backend

Ensure your backend FastAPI server is running.
The frontend communicates with it through:

```
GET http://127.0.0.1:8000/api/health
```

If you see a **“Server is healthy”** message in your browser, the connection is successful.



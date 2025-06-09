# API Endpoint Update Summary

This document summarizes the changes made to update API endpoints across the frontend to use the centralized production backend URL.

## Configuration Changes

The application now uses environment variables for API URLs:

### Development (.env)
```
VITE_API_URL=http://localhost:5000
```

### Production (.env.production) 
```
VITE_API_URL=https://doceasy-bcd3.onrender.com
```

## Updated Files

The following files have been updated to use the centralized API_URL from config:

1. **src/config.ts** - Central configuration file that exports API_URL
2. **vite.config.ts** - Added define for VITE_API_URL with environment-based values
3. **src/pages/DoctorProfileCreation.tsx** - Added import and removed hardcoded empty URL
4. **src/pages/DoctorRegistration.tsx** - Added import and removed hardcoded empty URL
5. **src/pages/dashboard/DoctorDashboardNew.tsx** - Added import and removed hardcoded empty URL
6. **src/pages/dashboard/Patient.tsx** - Added import and removed hardcoded empty URL
7. **src/pages/CheckoutPage.tsx** - Added import and removed hardcoded empty URL
8. **src/pages/VideoCall.tsx** - Added import and updated endpoint to use API_URL 
9. **src/pages/BookConsultation.tsx** - Added import and removed hardcoded empty URL

## API URL Usage

All API calls now use the centralized API_URL from config.ts:

```typescript
import { API_URL } from "@/config";

// API calls use the API_URL
const response = await axios.get(`${API_URL}/api/endpoint`, {...});
```

## Environment Variable Setup

To set up the environment variables:

1. Create a `.env` file in the root directory with the development URL
2. Create a `.env.production` file in the root directory with the production URL
3. The Vite build process will use the correct environment variables based on the build mode

## Deployment Notes

When deploying to services like Render, Vercel, or Netlify, make sure to:

1. Set the `VITE_API_URL` environment variable in the deployment platform settings
2. Ensure CORS is properly configured on the backend to allow requests from the frontend domain
3. Use `npm run build` to create a production build using the .env.production values 
# Deployment Guide for DocEasy Frontend

This guide explains how to prepare and deploy the DocEasy frontend to production.

## Environment Variables

The frontend uses the following environment variables:

- `VITE_API_URL`: The URL of the backend API

### Development

For development, create a `.env` file in the root directory with:

```
VITE_API_URL=http://localhost:5000
```

### Production

For production deployment on Render, Netlify, or Vercel, create a `.env.production` file with:

```
VITE_API_URL=https://doceasy-bcd3.onrender.com
```

Alternatively, you can set these environment variables directly in your deployment platform's settings.

## Building for Production

To build the application for production:

```bash
npm run build
```

This command will:
1. Use the values from `.env.production`
2. Generate optimized production files in the `dist` directory

## Deployment Platforms

### Render

1. Connect your GitHub repository
2. Create a new Static Site
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variable: `VITE_API_URL=https://doceasy-bcd3.onrender.com`

### Netlify

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variable: `VITE_API_URL=https://doceasy-bcd3.onrender.com`

### Vercel

1. Connect your GitHub repository
2. Vercel should automatically detect the Vite config
3. Add environment variable: `VITE_API_URL=https://doceasy-bcd3.onrender.com`

## CORS Configuration

The backend has already been updated to allow requests from the frontend domain. The current CORS configuration includes:

- `https://doceasy-1.onrender.com`
- Development URLs (`http://localhost:5173`, etc.)

If you deploy to a different domain, update the CORS configuration in the backend.

## Local Testing of Production Build

To test the production build locally:

1. Create a `.env.production.local` file with your local API URL
2. Build the application: `npm run build`
3. Serve the build directory: `npm run preview`

## Troubleshooting

If you encounter 401 Unauthorized errors:
- Check that the API URL is correct
- Verify your authentication tokens are being sent correctly
- Ensure CORS is properly configured on the backend

For network errors:
- Verify the API URL is accessible from your deployment environment
- Check if there are any network restrictions or firewalls blocking requests 
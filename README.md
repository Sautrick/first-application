# MediRec Deployment

This project is optimized for deployment on **Vercel** or **Netlify**.

## Vercel Deployment (Recommended)

1.  **Framework Preset**: Choose **Vite**.
2.  **Build Command**: `npm run build`
3.  **Output Directory**: `dist`
4.  **Environment Variables**:
    *   Add `GEMINI_API_KEY` in the Vercel Dashboard.

## Netlify Deployment

1.  **Build Command**: `npm run build`
2.  **Publish Directory**: `dist`
3.  **Environment Variables**:
    *   Add `GEMINI_API_KEY` in the Netlify Dashboard.

## Included Configurations

-   `vercel.json`: Configures SPA routing for Vercel.
-   `netlify.toml`: Configures the build for Netlify.
-   `public/_redirects`: Handles SPA routing for Netlify.

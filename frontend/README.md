# React + Vite

## Netlify deployment

The repository-root `netlify.toml` configures Netlify to run
`npm ci --include=dev && npm run build` in `frontend`, then publish
`frontend/dist`. The explicit install uses the frontend lockfile and includes
Vite and the other development dependencies required to build the site, even
when the deployment environment has not installed them beforehand.
It also rewrites application routes to `index.html` so direct links and page
refreshes work with React Router.

These settings override the previous Netlify UI base directory `frontnend`
and build command `npm install`. The correct base directory is `frontend`;
installing dependencies alone does not generate the production site.

This configuration deploys the frontend only. The backend is not deployed by
this configuration, and Vite's local `/api` proxy does not run in production.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

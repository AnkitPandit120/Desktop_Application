# Athena desktop exam

This repository combines the myAthena Electron frontend with a local exam backend.

## Run locally

Use Node.js 20 or later. Install each app once.

```sh
npm --prefix athena-backend ci
npm --prefix athena-frontend ci
npm run dev
```

The development command starts the backend, Vite, and Electron together. The backend uses port 3000 and Vite uses port 5173. Set `PORT` or `VITE_PORT` before running the command to use different ports. Closing the command stops the three processes.

Run `npm test`, `npm run lint`, and `npm run build` to check the project. Session records stay in the ignored backend data file.

The frontend originates from [myAthena](https://github.com/onlyaditya/myAthena). The exam backend and student details flow follow the local Athena exam reference supplied for this port.

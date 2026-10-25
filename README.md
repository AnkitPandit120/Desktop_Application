# Athena desktop exam

This repository combines the [myAthena](https://github.com/onlyaditya/myAthena) Electron interface with a local question and exam session backend. The archived myAthena question screen has been connected to the backend, so students can answer questions, resume an attempt, and see their result.

## Run locally

Use Node.js 22.12 or later. Install both apps, then start them together.

```sh
npm --prefix athena-backend ci
npm --prefix athena-frontend ci
npm run dev
```

The backend listens on `127.0.0.1:3000`, Vite on `127.0.0.1:5173`, and Electron opens the desktop window. `PORT` and `VITE_PORT` change those ports. The development command passes the chosen backend URL to Electron automatically. Closing the command stops all three processes.

Enter a name and URN, connect the camera, and choose **Go To Test**. Accept the rules to enter full screen. Answers save when selected. **End Test** submits the attempt, and the one-hour timer submits it automatically on expiry. Reloading or restarting Electron restores an active attempt or its submitted result.

## Local data

Questions are bundled in `athena-backend/data/questions.json`. Session records are saved in the ignored `athena-backend/data/sessions.json` file. Camera photos and the current session ID are stored under Electron's user data directory in `camera-feed/` and `exam-session.json`. On macOS, the default directory is `~/Library/Application Support/athena_phase_1/`. These files are not committed. On macOS and Linux, new session records and photos are private to the current user.

Set `ATHENA_DATA_DIR` to put backend sessions elsewhere. Set `ATHENA_USER_DATA_DIR` to use a separate Electron data directory. For a short local timer test, set `ATHENA_EXAM_DURATION_MS` to a positive number of milliseconds up to one hour before starting the backend. The normal duration is one hour.

## Checks

```sh
npm test
npm run lint
npm run build
npm --prefix athena-backend audit
npm --prefix athena-frontend audit
```

`npm test` covers the backend exam API, camera photo storage, and Electron session ID storage. A desktop flow was also checked on macOS with a synthetic camera for question navigation, answer recovery, submission, result recovery, timer expiry, and photo storage. A physical camera preview was checked separately. The green image in the test screenshot came from fake camera flags; `npm run dev` does not enable them.

## Source

The frontend layout and assets come from [myAthena](https://github.com/onlyaditya/myAthena) at commit `7ccac9fd6d89b92dfacc5b19bb28e3eacc6caa77`. Its archived `MainExam.jsx` screen was brought into the frontend and connected to this repository's backend. The backend and student details flow were adapted from the local Athena exam reference supplied for this project. The original ZIP snapshots remain in the source repository; existing personal exam attempts were not copied into this repository.

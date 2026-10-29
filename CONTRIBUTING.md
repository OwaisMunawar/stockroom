# Contributing

Use Node 22.13 or newer. The verified native environment uses Xcode 26.6 and Expo SDK 57. Keep SDK-pinned packages aligned with `expo/bundledNativeModules.json`.

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run doctor
```

Business rules belong in `shared/`; application orchestration depends on ports. Mobile code cannot import server/Node APIs and the server cannot import mobile adapters. Put platform integration in the composition root or a thin data adapter. Use real SQLite for persistence tests and real HTTP sockets for protocol tests. Component tests must await React Native Testing Library 14's render and event APIs.

Add a regression test that fails before a fix. Coverage gates select contracts, count rules, authority/persistence, sync orchestration and HTTP behavior; thin native drivers are verified separately.

For a self-contained simulator build, run `bash tool/build-ios.sh`. For the local UI workflow, create your own simulator, install `ios/build/Build/Products/Release-iphonesimulator/Stockroom.app`, generate the runner with `xcodegen generate --spec verification/project.yml`, and run:

```sh
python3 tool/capture-simulator.py <simulator-id> testOfflineCountAndConflictReview
```

The test expects a clean demo database and an available Foundation Models model. To test HTTP delivery, run the reference server, rebuild the app with `EXPO_PUBLIC_SYNC_ORIGIN`, and select `testHTTPReferenceServer`. Device IDs are arguments, never checked-in constants. Delete only the simulator and build artifacts you created.

Use synthetic data in tests and captures. Label real model results, rules output and demo transport accurately. Do not commit credentials, local databases or signing identifiers. Follow [SECURITY.md](SECURITY.md) for private reports.

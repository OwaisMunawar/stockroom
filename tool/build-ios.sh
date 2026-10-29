#!/bin/bash
set -euo pipefail
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
CI=1 RCT_NO_LAUNCH_PACKAGER=1 xcodebuild \
  -workspace ios/Stockroom.xcworkspace -scheme Stockroom \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO build

"""Run a selected native UI test and capture unedited screenshots with simctl."""
import pathlib
import re
import subprocess
import sys

if len(sys.argv) != 3:
    raise SystemExit("Usage: python3 tool/capture-simulator.py <simulator-id> <test-method>")
device, method = sys.argv[1:]
if method not in {"testOfflineCountAndConflictReview", "testHTTPReferenceServer"}:
    raise SystemExit("Unknown verification test")
output = pathlib.Path("docs/screenshots")
output.mkdir(parents=True, exist_ok=True)
command = ["xcodebuild", "test", "-project", "verification/StockroomVerification.xcodeproj",
           "-scheme", "StockroomVerification", "-destination", f"platform=iOS Simulator,id={device}",
           "-derivedDataPath", "verification/build", "-only-testing", f"StockroomUITests/StockroomUITests/{method}",
           "CODE_SIGNING_ALLOWED=NO"]
process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
assert process.stdout is not None
try:
    for line in process.stdout:
        print(line, end="", flush=True)
        match = re.search(r"STOCKROOM_SCREENSHOT:([a-z-]+)", line)
        if match:
            subprocess.run(["xcrun", "simctl", "io", device, "screenshot", str(output / f"{match.group(1)}.png")], check=True)
    raise SystemExit(process.wait())
finally:
    if process.poll() is None:
        process.terminate()

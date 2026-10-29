import XCTest

@MainActor
final class StockroomUITests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "com.owaismunawar.stockroom")

  private func tap(_ identifier: String) {
    let target = app.descendants(matching: .any)[identifier].firstMatch
    for _ in 0..<12 where !target.isHittable { app.scrollViews.firstMatch.swipeUp() }
    XCTAssertTrue(target.waitForExistence(timeout: 45), identifier)
    target.tap()
  }

  private func checkpoint(_ name: String) {
    print("STOCKROOM_SCREENSHOT:\(name)")
    fflush(nil)
    Thread.sleep(forTimeInterval: 3)
  }

  func testOfflineCountAndConflictReview() {
    continueAfterFailure = false
    app.launch()
    XCTAssertTrue(app.staticTexts["Stockroom"].waitForExistence(timeout: 30))
    checkpoint("inventory")
    tap("tab-count")
    tap("parse-count")
    XCTAssertTrue(app.staticTexts["ON-DEVICE AI"].waitForExistence(timeout: 60))
    let review = app.descendants(matching: .any)["queue-count"].firstMatch
    for _ in 0..<8 where !review.isHittable { app.scrollViews.firstMatch.swipeUp() }
    checkpoint("on-device-count-review")
    tap("queue-count")
    XCTAssertTrue(app.staticTexts["QUEUED ON THIS DEVICE"].waitForExistence(timeout: 15))
    checkpoint("offline-outbox")
    tap("simulate-competition")
    tap("online-switch")
    tap("sync-now")
    XCTAssertTrue(app.staticTexts["REVISION CONFLICT"].waitForExistence(timeout: 15))
    app.scrollViews.firstMatch.swipeDown()
    checkpoint("conflict-review")
    let note = app.textViews["conflict-note"].firstMatch
    if !note.isHittable { app.scrollViews.firstMatch.swipeUp() }
    note.tap()
    note.typeText("Shelf B2 recounted. Confirmed 14 against the displayed server revision.")
    app.scrollViews.firstMatch.swipeUp()
    tap("requeue-count")
    tap("sync-now")
    XCTAssertTrue(app.staticTexts["Nothing waiting"].waitForExistence(timeout: 15))
    tap("tab-inventory")
    XCTAssertEqual(app.staticTexts["quantity-brass-adapter"].label, "14")
    checkpoint("receipt-confirmed-stock")
    tap("tab-ledger")
    XCTAssertTrue(app.staticTexts["1 SERVER-CONFIRMED COUNT"].waitForExistence(timeout: 10))
    checkpoint("receipt-ledger")
    tap("preview-report")
    checkpoint("server-only-report")
  }

  func testHTTPReferenceServer() {
    continueAfterFailure = false
    app.launch()
    XCTAssertTrue(app.staticTexts["Stockroom"].waitForExistence(timeout: 30))
    XCTAssertTrue(app.staticTexts["HTTP REFERENCE SERVER · SINGLE WAREHOUSE"].exists)
    tap("tab-count")
    tap("parse-count")
    XCTAssertTrue(app.staticTexts["ON-DEVICE AI"].waitForExistence(timeout: 60))
    tap("queue-count")
    tap("online-switch")
    tap("sync-now")
    XCTAssertTrue(app.staticTexts["Nothing waiting"].waitForExistence(timeout: 20))
    tap("tab-ledger")
    XCTAssertTrue(app.staticTexts["1 SERVER-CONFIRMED COUNT"].waitForExistence(timeout: 10))
    checkpoint("http-receipt-ledger")
  }
}

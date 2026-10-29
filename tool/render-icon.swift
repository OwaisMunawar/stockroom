import AppKit

let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8,
  bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
NSColor(calibratedRed: 0.09, green: 0.157, blue: 0.247, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()
context.translateBy(x: 512, y: 532)
context.rotate(by: 8 * .pi / 180)
let box = NSBezierPath(roundedRect: NSRect(x: -252, y: -252, width: 504, height: 504), xRadius: 85, yRadius: 85)
box.lineWidth = 78
NSColor(calibratedRed: 0.882, green: 0.992, blue: 0.471, alpha: 1).setStroke()
box.stroke()
NSColor.white.setStroke()
let lines = NSBezierPath()
lines.move(to: NSPoint(x: -117, y: 17))
lines.line(to: NSPoint(x: 118, y: 17))
lines.move(to: NSPoint(x: -117, y: -93))
lines.line(to: NSPoint(x: 28, y: -93))
lines.lineWidth = 52
lines.lineCapStyle = .round
lines.stroke()
NSGraphicsContext.restoreGraphicsState()
try NSBitmapImageRep(cgImage: context.makeImage()!).representation(using: .png, properties: [:])!
  .write(to: URL(fileURLWithPath: "assets/icon.png"))

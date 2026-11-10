import Foundation
import AppKit
import CoreGraphics

let width = 1200
let height = 800

let colorSpace = CGColorSpaceCreateDeviceRGB()
let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue)

guard let ctx = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: bitmapInfo.rawValue
) else {
    print("Failed to create context")
    exit(1)
}

// 1. Dark Premium Gradient Background
let bgColors = [
    NSColor(red: 0.04, green: 0.07, blue: 0.15, alpha: 1.0).cgColor,
    NSColor(red: 0.015, green: 0.03, blue: 0.07, alpha: 1.0).cgColor
] as CFArray

if let bgGrad = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: [0.0, 1.0]) {
    ctx.drawRadialGradient(
        bgGrad,
        startCenter: CGPoint(x: 600, y: 480),
        startRadius: 50,
        endCenter: CGPoint(x: 600, y: 400),
        endRadius: 750,
        options: [.drawsAfterEndLocation, .drawsBeforeStartLocation]
    )
}

// Subtle ambient glow behind the logo
ctx.saveGState()
let glowColors = [
    NSColor(red: 0.0, green: 0.44, blue: 0.85, alpha: 0.28).cgColor,
    NSColor(red: 0.0, green: 0.8, blue: 1.0, alpha: 0.08).cgColor,
    NSColor.clear.cgColor
] as CFArray
if let glowGrad = CGGradient(colorsSpace: colorSpace, colors: glowColors, locations: [0.0, 0.5, 1.0]) {
    ctx.drawRadialGradient(
        glowGrad,
        startCenter: CGPoint(x: 600, y: 490),
        startRadius: 20,
        endCenter: CGPoint(x: 600, y: 490),
        endRadius: 260,
        options: []
    )
}
ctx.restoreGState()

// 2. Central Logo Emblem Badge (Squircle)
let badgeSize: CGFloat = 190.0
let badgeRect = CGRect(x: (CGFloat(width) - badgeSize) / 2.0, y: 400.0, width: badgeSize, height: badgeSize)

// Drop shadow for the badge
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 35, color: NSColor(red: 0.0, green: 0.4, blue: 0.9, alpha: 0.45).cgColor)

let badgePath = CGPath(roundedRect: badgeRect, cornerWidth: 44, cornerHeight: 44, transform: nil)
ctx.addPath(badgePath)
ctx.setFillColor(NSColor(red: 0.06, green: 0.11, blue: 0.22, alpha: 0.95).cgColor)
ctx.fillPath()
ctx.restoreGState()

// Badge Border (Gradient Stroke)
ctx.saveGState()
ctx.addPath(badgePath)
ctx.setLineWidth(2.5)
ctx.setStrokeColor(NSColor(red: 0.2, green: 0.55, blue: 0.95, alpha: 0.8).cgColor)
ctx.strokePath()
ctx.restoreGState()

// 3. Stylized Interlocking "Pact" & "Pay" Monogram inside the badge
// Two interlocking fluid geometric bands forming a dynamic P + Shield/Milestone check
let iconCenterX: CGFloat = 600.0
let iconCenterY: CGFloat = 495.0

// First ribbon (Back - Deep Blue)
ctx.saveGState()
let p1Path = CGMutablePath()
// Left vertical stem of primary P
p1Path.addRoundedRect(in: CGRect(x: iconCenterX - 45, y: iconCenterY - 45, width: 22, height: 90), cornerWidth: 11, cornerHeight: 11)
// Upper loop of primary P
p1Path.addRoundedRect(in: CGRect(x: iconCenterX - 45, y: iconCenterY + 8, width: 75, height: 42), cornerWidth: 21, cornerHeight: 21)

ctx.addPath(p1Path)
let p1GradColors = [
    NSColor(red: 0.0, green: 0.45, blue: 0.85, alpha: 1.0).cgColor,
    NSColor(red: 0.05, green: 0.30, blue: 0.70, alpha: 1.0).cgColor
] as CFArray
if let p1Grad = CGGradient(colorsSpace: colorSpace, colors: p1GradColors, locations: [0.0, 1.0]) {
    ctx.clip()
    ctx.drawLinearGradient(p1Grad, start: CGPoint(x: iconCenterX - 45, y: iconCenterY + 45), end: CGPoint(x: iconCenterX + 30, y: iconCenterY - 45), options: [])
}
ctx.restoreGState()

// Second ribbon (Front - Electric Cyan / Mint) interlocking the milestone loop
ctx.saveGState()
let p2Path = CGMutablePath()
// Right vertical stem offset (Milestone verification / second P loop)
p2Path.addRoundedRect(in: CGRect(x: iconCenterX - 15, y: iconCenterY - 30, width: 20, height: 75), cornerWidth: 10, cornerHeight: 10)
p2Path.addRoundedRect(in: CGRect(x: iconCenterX - 15, y: iconCenterY - 18, width: 62, height: 38), cornerWidth: 19, cornerHeight: 19)

ctx.setShadow(offset: CGSize(width: -4, height: 4), blur: 12, color: NSColor.black.withAlphaComponent(0.6).cgColor)
ctx.addPath(p2Path)
let p2GradColors = [
    NSColor(red: 0.0, green: 0.85, blue: 0.95, alpha: 1.0).cgColor,
    NSColor(red: 0.0, green: 0.65, blue: 0.85, alpha: 1.0).cgColor
] as CFArray
if let p2Grad = CGGradient(colorsSpace: colorSpace, colors: p2GradColors, locations: [0.0, 1.0]) {
    ctx.clip()
    ctx.drawLinearGradient(p2Grad, start: CGPoint(x: iconCenterX - 15, y: iconCenterY + 30), end: CGPoint(x: iconCenterX + 50, y: iconCenterY - 30), options: [])
}
ctx.restoreGState()

// Inner core node (Golden / White milestone spark)
ctx.saveGState()
let dotRect = CGRect(x: iconCenterX + 8, y: iconCenterY + 22, width: 10, height: 10)
ctx.setShadow(offset: .zero, blur: 8, color: NSColor.white.cgColor)
ctx.setFillColor(NSColor.white.cgColor)
ctx.fillEllipse(in: dotRect)
ctx.restoreGState()

// 4. Typography
let nsCtx = NSGraphicsContext(cgContext: ctx, flipped: false)
NSGraphicsContext.current = nsCtx

// "Pact" (White) + "Pay" (Cyan Blue)
let pactAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 68, weight: .heavy),
    .foregroundColor: NSColor.white
]
let payAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 68, weight: .heavy),
    .foregroundColor: NSColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0) // Sky / Cyan
]

let titlePact = NSAttributedString(string: "Pact", attributes: pactAttrs)
let titlePay = NSAttributedString(string: "Pay", attributes: payAttrs)
let fullTitle = NSMutableAttributedString()
fullTitle.append(titlePact)
fullTitle.append(titlePay)

let titleSize = fullTitle.size()
let titleOrigin = CGPoint(x: (CGFloat(width) - titleSize.width) / 2.0, y: 285.0)
fullTitle.draw(at: titleOrigin)

// Subtitle
let subAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 22, weight: .medium),
    .foregroundColor: NSColor(red: 0.65, green: 0.75, blue: 0.88, alpha: 1.0)
]
let subtitleStr = "Autonomous B2B Procurement & Milestone Payments" as NSString
let subSize = subtitleStr.size(withAttributes: subAttrs)
subtitleStr.draw(at: CGPoint(x: (CGFloat(width) - subSize.width) / 2.0, y: 235.0), withAttributes: subAttrs)

// 5. Sponsor / Category Pill Tag
let pillText = "PAYPAL AI HACKATHON 2026  •  6 REST APIS  •  CHANNEL3" as NSString
let pillAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 13, weight: .bold),
    .foregroundColor: NSColor(red: 0.30, green: 0.78, blue: 0.98, alpha: 1.0)
]
let pillTextSize = pillText.size(withAttributes: pillAttrs)
let pillW = pillTextSize.width + 36.0
let pillH: CGFloat = 34.0
let pillX = (CGFloat(width) - pillW) / 2.0
let pillY: CGFloat = 160.0
let pillRect = CGRect(x: pillX, y: pillY, width: pillW, height: pillH)

let pillPath = CGPath(roundedRect: pillRect, cornerWidth: pillH / 2.0, cornerHeight: pillH / 2.0, transform: nil)
ctx.setFillColor(NSColor(red: 0.05, green: 0.12, blue: 0.25, alpha: 0.85).cgColor)
ctx.addPath(pillPath)
ctx.fillPath()

ctx.setLineWidth(1.5)
ctx.setStrokeColor(NSColor(red: 0.15, green: 0.35, blue: 0.65, alpha: 0.7).cgColor)
ctx.addPath(pillPath)
ctx.strokePath()

pillText.draw(at: CGPoint(x: pillX + 18.0, y: pillY + 8.5), withAttributes: pillAttrs)

// 6. Save image
guard let finalCG = ctx.makeImage() else {
    print("Failed to make image")
    exit(1)
}

let rep = NSBitmapImageRep(cgImage: finalCG)
guard let pngData = rep.representation(using: .png, properties: [:]) else {
    print("Failed to get PNG data")
    exit(1)
}

let outPath = "artifacts/pactpay-devpost-thumbnail.png"
try? pngData.write(to: URL(fileURLWithPath: outPath))
try? pngData.write(to: URL(fileURLWithPath: "/Users/amogh/Desktop/pactpay-devpost-thumbnail.png"))
print("Successfully generated clean logo thumbnail (1200x800 3:2) with NO screenshots!")

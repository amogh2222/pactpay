import Foundation
import AVFoundation
import AppKit
import CoreGraphics
import CoreVideo

let width = 1920
let height = 1080
let fps: Int32 = 30

struct SceneDef {
    let id: Int
    let imagePath: String
    let title: String
    let subtitle: String
    let durationSeconds: Double
}

let scenes: [SceneDef] = [
    SceneDef(
        id: 1,
        imagePath: "artifacts/pactpay-architecture-4x3.png",
        title: "01 / ARCHITECTURE & THE B2B PROCUREMENT PROBLEM",
        subtitle: "Three Autonomous Agents • Six Chained PayPal Sandbox APIs • Contractual SLA Recovery",
        durationSeconds: 29.70
    ),
    SceneDef(
        id: 2,
        imagePath: "artifacts/pactpay-dashboard.jpg",
        title: "02 / SOURCING AGENT & CHANNEL3 MULTI-VENDOR DISCOVERY",
        subtitle: "Natural Language Intent Parsing • Multi-Supplier Price, MOQ & SLA Benchmarking",
        durationSeconds: 23.43
    ),
    SceneDef(
        id: 3,
        imagePath: "artifacts/pactpay-completed-run.jpg",
        title: "03 / TREASURY AGENT, PAYPAL INVOICING & CFO GUARDRAIL",
        subtitle: "PayPal Catalog v1 SKU Registration • Invoicing v2 with QR Reference • Spend Limit Check",
        durationSeconds: 22.43
    ),
    SceneDef(
        id: 4,
        imagePath: "artifacts/pactpay-completed-run.jpg",
        title: "04 / CHECKOUT ORDERS v2 CAPTURE & SHIPPING TRACKERS v1",
        subtitle: "Milestone Payment Capture • Binding Carrier Tracking to PayPal Capture ID",
        durationSeconds: 15.82
    ),
    SceneDef(
        id: 5,
        imagePath: "artifacts/pactpay-completed-run.jpg",
        title: "05 / SLA AUDITOR AGENT & $524.69 REFUND RECOVERY",
        subtitle: "Carrier Exception Detection • PayPal Captures Refund v2 Automated Penalty Rebate",
        durationSeconds: 21.92
    ),
    SceneDef(
        id: 6,
        imagePath: "artifacts/pactpay-dashboard.jpg",
        title: "06 / AG GRID LEDGER, REAL-TIME TELEMETRY & LIVE DEMO",
        subtitle: "AG Studio Natural Language Query Bar • Downloadable Audit Dossier • pactpayon.vercel.app",
        durationSeconds: 21.66
    )
]

let totalDuration = scenes.reduce(0) { $0 + $1.durationSeconds }
print("Total video duration: \(String(format: "%.2f", totalDuration)) seconds")

// Pre-load images
var loadedImages: [Int: CGImage] = [:]
for s in scenes {
    if loadedImages[s.id] == nil {
        if let nsImg = NSImage(contentsOfFile: s.imagePath),
           let cgImg = nsImg.cgImage(forProposedRect: nil, context: nil, hints: nil) {
            loadedImages[s.id] = cgImg
        } else {
            print("Warning: Could not load \(s.imagePath)")
        }
    }
}

let tempVideoURL = URL(fileURLWithPath: ".video_build/temp_video.mp4")
try? FileManager.default.removeItem(at: tempVideoURL)

guard let writer = try? AVAssetWriter(outputURL: tempVideoURL, fileType: .mp4) else {
    print("Error: Could not create AVAssetWriter")
    exit(1)
}

let videoSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 6_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ]
]

let writerInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
writerInput.expectsMediaDataInRealTime = false

let sourcePixelBufferAttributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
]

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: writerInput,
    sourcePixelBufferAttributes: sourcePixelBufferAttributes
)

writer.add(writerInput)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

// Pixel buffer pool
guard let pool = adaptor.pixelBufferPool else {
    print("Error: No pixel buffer pool")
    exit(1)
}

let colorSpace = CGColorSpaceCreateDeviceRGB()
let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue)

var currentFrame: Int64 = 0
let totalFrames = Int64(totalDuration * Double(fps))

print("Rendering \(totalFrames) video frames...")

for (sceneIndex, scene) in scenes.enumerated() {
    let sceneFrameCount = Int64(scene.durationSeconds * Double(fps))
    let cgImg = loadedImages[scene.id]
    
    for f in 0..<sceneFrameCount {
        while !writerInput.isReadyForMoreMediaData {
            usleep(1000)
        }
        
        var pixelBuffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBuffer)
        guard let pb = pixelBuffer else { continue }
        
        CVPixelBufferLockBaseAddress(pb, [])
        let data = CVPixelBufferGetBaseAddress(pb)
        
        guard let ctx = CGContext(
            data: data,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
            space: colorSpace,
            bitmapInfo: bitmapInfo.rawValue
        ) else {
            CVPixelBufferUnlockBaseAddress(pb, [])
            continue
        }
        
        // 1. Draw Background
        ctx.setFillColor(red: 11.0/255.0, green: 15.0/255.0, blue: 25.0/255.0, alpha: 1.0)
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        
        // Subtle decorative gradient rect
        let gradientColors = [
            NSColor(red: 0.05, green: 0.10, blue: 0.22, alpha: 1.0).cgColor,
            NSColor(red: 0.02, green: 0.04, blue: 0.08, alpha: 1.0).cgColor
        ] as CFArray
        if let grad = CGGradient(colorsSpace: colorSpace, colors: gradientColors, locations: [0.0, 1.0]) {
            ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: 1080), end: CGPoint(x: 1920, y: 0), options: [])
        }
        
        // 2. Draw Image (Screenshot) centered with nice aspect fit & padding
        if let img = cgImg {
            let imgW = CGFloat(img.width)
            let imgH = CGFloat(img.height)
            let maxW: CGFloat = 1760.0
            let maxH: CGFloat = 860.0
            let scale = min(maxW / imgW, maxH / imgH)
            
            // Subtle Ken Burns zoom effect (1.00 -> 1.02 over the scene)
            let progress = CGFloat(f) / CGFloat(sceneFrameCount)
            let zoom = 1.0 + (progress * 0.02)
            let finalW = imgW * scale * zoom
            let finalH = imgH * scale * zoom
            
            let imgX = (CGFloat(width) - finalW) / 2.0
            let imgY: CGFloat = 80.0 + ((maxH - finalH) / 2.0)
            
            // Draw drop shadow container
            ctx.saveGState()
            ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 25, color: NSColor.black.withAlphaComponent(0.6).cgColor)
            ctx.setFillColor(NSColor(red: 0.1, green: 0.15, blue: 0.25, alpha: 1.0).cgColor)
            let borderRect = CGRect(x: imgX - 3, y: imgY - 3, width: finalW + 6, height: finalH + 6)
            ctx.fill(borderRect)
            ctx.restoreGState()
            
            ctx.draw(img, in: CGRect(x: imgX, y: imgY, width: finalW, height: finalH))
        }
        
        // 3. Draw Header Bar (Top)
        let headerRect = CGRect(x: 0, y: 990, width: width, height: 90)
        ctx.setFillColor(NSColor(red: 0.04, green: 0.06, blue: 0.12, alpha: 0.95).cgColor)
        ctx.fill(headerRect)
        
        // Blue line under header
        ctx.setFillColor(NSColor(red: 0.0, green: 0.44, blue: 0.73, alpha: 1.0).cgColor) // PayPal blue
        ctx.fill(CGRect(x: 0, y: 990, width: width, height: 3))
        
        // Header Text using NSAttributedString
        let nsCtx = NSGraphicsContext(cgContext: ctx, flipped: false)
        NSGraphicsContext.current = nsCtx
        
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.boldSystemFont(ofSize: 24),
            .foregroundColor: NSColor.white
        ]
        let subAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 15, weight: .medium),
            .foregroundColor: NSColor(red: 0.6, green: 0.7, blue: 0.85, alpha: 1.0)
        ]
        
        (scene.title as NSString).draw(at: CGPoint(x: 60, y: 1040), withAttributes: titleAttrs)
        (scene.subtitle as NSString).draw(at: CGPoint(x: 60, y: 1008), withAttributes: subAttrs)
        
        // Brand Mark (Right)
        let brandAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.boldSystemFont(ofSize: 22),
            .foregroundColor: NSColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0) // Cyan
        ]
        ("PactPay" as NSString).draw(at: CGPoint(x: 1740, y: 1030), withAttributes: brandAttrs)
        
        // 4. Draw Footer Bar (Bottom)
        let footerRect = CGRect(x: 0, y: 0, width: width, height: 60)
        ctx.setFillColor(NSColor(red: 0.04, green: 0.06, blue: 0.12, alpha: 0.95).cgColor)
        ctx.fill(footerRect)
        
        let footerAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 15, weight: .semibold),
            .foregroundColor: NSColor(red: 0.7, green: 0.8, blue: 0.9, alpha: 1.0)
        ]
        ("PayPal AI Hackathon 2026 • Live Demo: pactpayon.vercel.app • GitHub: amogh2222/pactpay" as NSString).draw(
            at: CGPoint(x: 60, y: 22),
            withAttributes: footerAttrs
        )
        
        // Time code
        let currentSeconds = Double(currentFrame) / Double(fps)
        let curMin = Int(currentSeconds) / 60
        let curSec = Int(currentSeconds) % 60
        let totMin = Int(totalDuration) / 60
        let totSec = Int(totalDuration) % 60
        let timeStr = String(format: "%02d:%02d / %02d:%02d", curMin, curSec, totMin, totSec)
        
        let timeAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedSystemFont(ofSize: 16, weight: .bold),
            .foregroundColor: NSColor(red: 0.2, green: 0.8, blue: 0.5, alpha: 1.0) // Green
        ]
        (timeStr as NSString).draw(at: CGPoint(x: 1740, y: 22), withAttributes: timeAttrs)
        
        // Animated Progress Bar across bottom
        let totalProg = CGFloat(currentFrame) / CGFloat(totalFrames)
        let barW = CGFloat(width) * totalProg
        ctx.setFillColor(NSColor(red: 0.0, green: 0.6, blue: 1.0, alpha: 1.0).cgColor)
        ctx.fill(CGRect(x: 0, y: 56, width: barW, height: 4))
        
        CVPixelBufferUnlockBaseAddress(pb, [])
        
        let frameTime = CMTime(value: currentFrame, timescale: fps)
        adaptor.append(pb, withPresentationTime: frameTime)
        currentFrame += 1
    }
    print("Finished scene \(sceneIndex + 1)/\(scenes.count): \(scene.title)")
}

writerInput.markAsFinished()

let sema = DispatchSemaphore(value: 0)
writer.finishWriting {
    print("Video track finished writing!")
    sema.signal()
}
sema.wait()

// MERGE VIDEO + AUDIO
print("Merging video track with audio narration...")

let composition = AVMutableComposition()
let videoAsset = AVURLAsset(url: tempVideoURL)
let audioAsset = AVURLAsset(url: URL(fileURLWithPath: ".video_build/narration_full.m4a"))

guard let compVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let compAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
    print("Error: Could not add composition tracks")
    exit(1)
}

if let videoTrack = videoAsset.tracks(withMediaType: .video).first {
    try? compVideoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: videoAsset.duration), of: videoTrack, at: .zero)
}

if let audioTrack = audioAsset.tracks(withMediaType: .audio).first {
    let dur = min(audioAsset.duration, videoAsset.duration)
    try? compAudioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: dur), of: audioTrack, at: .zero)
}

let finalOutputURL = URL(fileURLWithPath: "artifacts/pactpay-demo.mp4")
try? FileManager.default.removeItem(at: finalOutputURL)

guard let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPreset1920x1080) else {
    print("Error: Could not create final export session")
    exit(1)
}

exportSession.outputURL = finalOutputURL
exportSession.outputFileType = .mp4

let exportSema = DispatchSemaphore(value: 0)
exportSession.exportAsynchronously {
    print("Final MP4 export status: \(exportSession.status.rawValue)")
    if exportSession.status == .completed {
        print("SUCCESS! Generated artifacts/pactpay-demo.mp4")
    } else if let err = exportSession.error {
        print("Export error: \(err.localizedDescription)")
    }
    exportSema.signal()
}
exportSema.wait()


import Foundation
import AVFoundation

let composition = AVMutableComposition()
guard let compositionTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
    print("Failed to add track")
    exit(1)
}

var currentTime = CMTime.zero

for i in 1...6 {
    let url = URL(fileURLWithPath: ".video_build/scene_\(i).m4a")
    let asset = AVURLAsset(url: url)
    if let track = asset.tracks(withMediaType: .audio).first {
        let timeRange = CMTimeRange(start: .zero, duration: asset.duration)
        try? compositionTrack.insertTimeRange(timeRange, of: track, at: currentTime)
        currentTime = CMTimeAdd(currentTime, asset.duration)
    }
}

let exportURL = URL(fileURLWithPath: ".video_build/narration_full.m4a")
try? FileManager.default.removeItem(at: exportURL)

guard let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
    print("Failed to create export session")
    exit(1)
}

exportSession.outputURL = exportURL
exportSession.outputFileType = .m4a

let sema = DispatchSemaphore(value: 0)
exportSession.exportAsynchronously {
    if exportSession.status == .completed {
        print("Concatenated audio successfully!")
    } else {
        print("Audio error: \(String(describing: exportSession.error))")
    }
    sema.signal()
}
sema.wait()

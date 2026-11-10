import asyncio
import os
import subprocess
import json
import edge_tts

scenes = [
    {
        "id": 1,
        "text": "Hi everyone, I'm really excited to share PactPay with you today! We built this for the PayPal AI Hackathon to fix a major headache in enterprise purchasing. Today, finding suppliers, paying invoices, and tracking packages happen in completely separate systems. And even though wholesale contracts almost always include SLA penalty clauses—like a 15% discount if goods arrive late or damaged—companies almost never recover that money because shipping data is never connected to the payment ledger. PactPay solves this by connecting three specialist AI agents across six PayPal REST API families."
    },
    {
        "id": 2,
        "text": "Here's our live workspace. It all starts when an employee submits a natural language request, like: Procure 35 ergonomic chairs under $410 for Workspace Ops. Our Sourcing Agent immediately extracts the item, quantity, and budget limits, then searches the Channel3 supplier network. It benchmarks three competing quotes across pricing, lead times, and SLA terms, selecting Walmart as our winning vendor."
    },
    {
        "id": 3,
        "text": "Next, our Treasury Agent takes over. It registers the item in PayPal Catalog v1, and generates an itemized invoice with a payment QR code using PayPal Invoicing v2. It also checks our internal spend limit: because this purchase is under our fifteen-thousand-dollar guardrail, it auto-clears. If it had exceeded the budget, the agent would pause and wait for CFO authorization."
    },
    {
        "id": 4,
        "text": "Once approved, payment is captured through PayPal Checkout Orders v2. Our system immediately connects logistics using PayPal Shipping Trackers v1, linking the carrier tracking number directly to the PayPal capture transaction ID so fulfillment is tied to the payment."
    },
    {
        "id": 5,
        "text": "Now, here's where the real recovery happens. If FedEx logs a delivery exception, like damaged cartons or a 48-hour delay, our SLA Auditor agent reads the contract clause, calculates the exact 15% penalty, and automatically issues a 524 dollar and 69 cent refund using PayPal Captures Refund v2. The buyer gets their money back instantly without filing claims or sending angry emails."
    },
    {
        "id": 6,
        "text": "All of this updates our live AG Grid ledger in real time. Finance teams can search in plain English, view spend charts, and inspect every single PayPal API call in our telemetry tab. You can try out the live demo right now at pactpayon.vercel.app, and view our open-source code on GitHub. Thanks for watching!"
    }
]

os.makedirs(".video_build", exist_ok=True)

async def synthesize_all():
    durations = []
    total = 0.0
    for s in scenes:
        mp3_path = f".video_build/scene_{s['id']}.mp3"
        m4a_path = f".video_build/scene_{s['id']}.m4a"
        
        # en-US-JennyNeural: ultra-realistic sweet conversational female voice, 1x rate
        communicate = edge_tts.Communicate(s["text"], "en-US-JennyNeural", rate="+0%")
        await communicate.save(mp3_path)
        
        # Convert to standard AAC M4A for AVFoundation
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", mp3_path, m4a_path], check=True)
        
        # Measure duration
        out = subprocess.check_output(["afinfo", m4a_path]).decode()
        for line in out.splitlines():
            if "estimated duration:" in line:
                dur = float(line.split()[2])
                durations.append(dur)
                total += dur
                print(f"Scene {s['id']}: {dur:.2f}s")
                break
                
    print(f"Total neural audio duration: {total:.2f}s ({total/60:.2f} mins)")
    with open(".video_build/durations.json", "w") as f:
        json.dump(durations, f)

if __name__ == "__main__":
    asyncio.run(synthesize_all())

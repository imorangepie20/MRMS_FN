import { TtsApp } from "@/components/apps/ai-tts/tts-app"

export default function TextToSpeechPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Text to Speech</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <TtsApp />
      </div>
    </div>
  )
}

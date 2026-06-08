import { ImageGeneratorApp } from "@/components/apps/ai-image/image-generator-app"

export default function ImageGeneratorPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">AI Image Generator</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <ImageGeneratorApp />
      </div>
    </div>
  )
}

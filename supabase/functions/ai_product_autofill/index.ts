import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://escloset.vestigh.com"
const API_ENDPOINT = "aiplatform.googleapis.com"
const MODEL_ID = "gemini-3.1-flash-lite-preview"
const GENERATE_CONTENT_API = "streamGenerateContent"
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
}

type InlineImageInput = {
  data?: string
  mimeType?: string
}

type RequestBody = {
  product_name?: string
  category?: string
  image?: InlineImageInput
}

type GeminiChunk = {
  candidates?: Array<{
    finishReason?: string
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"])

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })

const parseStreamChunks = (rawText: string): GeminiChunk[] => {
  try {
    const parsed = JSON.parse(rawText) as unknown

    if (Array.isArray(parsed)) {
      return parsed as GeminiChunk[]
    }

    if (parsed && typeof parsed === "object") {
      return [parsed as GeminiChunk]
    }
  } catch {
    const lineChunks: GeminiChunk[] = []
    const normalizedLines = rawText
      .split("\n")
      .map((line) => line.trim())
      .map((line) => (line.startsWith("data:") ? line.slice(5).trim() : line))
      .filter((line) => Boolean(line) && line !== "[DONE]")

    for (const line of normalizedLines) {
      try {
        const parsed = JSON.parse(line) as unknown
        if (parsed && typeof parsed === "object") {
          lineChunks.push(parsed as GeminiChunk)
        }
      } catch {
        // Ignore non-JSON lines in stream format.
      }
    }

    if (lineChunks.length > 0) {
      return lineChunks
    }
  }

  throw new Error("Unsupported Gemini stream format")
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "Method not allowed",
    })
  }

  try {
    const body = (await req.json()) as RequestBody

    const productName = typeof body.product_name === "string" ? body.product_name.trim() : ""
    const category = typeof body.category === "string" ? body.category.trim() : ""
    const image = body.image

    if (!productName) {
      return jsonResponse(400, {
        success: false,
        message: "Product name is required",
      })
    }

    if (!GEMINI_API_KEY) {
      return jsonResponse(500, {
        success: false,
        message: "API key not configured",
      })
    }

    if (image?.mimeType && !allowedMimeTypes.has(image.mimeType)) {
      return jsonResponse(400, {
        success: false,
        message: "Unsupported image format. Use JPEG, PNG or WebP.",
      })
    }

    const hasImage =
      typeof image?.data === "string" &&
      image.data.trim() !== "" &&
      typeof image?.mimeType === "string" &&
      image.mimeType.trim() !== ""

    const parts: Array<Record<string, unknown>> = []

    parts.push({
      text: `You are the voice of a modern fashion brand.

You write product content in a clear, confident, and natural way.
Your writing should feel human and grounded — not poetic, not overly styled, and not like a fashion magazine.

---

INPUT:
${hasImage 
? `An image of the product is provided.

Use ONLY what you can see:
- silhouette
- fit
- color
- pattern
- fabric behavior (flowy, structured, light, heavy)
- visible styling details

Do NOT invent details.`
: `No image is provided.

Generate content based only on the product name and category.
Do NOT assume specific colors, textures, or visual details.`}

---

PRODUCT:
Name: ${productName}
${category ? `Category: ${category}` : ""}

---

WRITING STYLE RULES:

- Be specific, not abstract
- Avoid generic phrases like:
  "understated elegance", "timeless", "luxurious", "premium", "elevated"
- Avoid poetic or dramatic language
- No metaphors
- Keep sentences clean and direct
- Sound like a real brand, not a stylist or magazine

---

TONE:

- Modern
- Confident
- Effortless
- Practical

---

OUTPUT:

Generate the following:

1. Product Title (clean and simple)
2. Short Description (1–2 sentences)
3. Full Description (3–5 sentences, clear and informative)

---

GOAL:

Make the product easy to understand and easy to imagine wearing.
Focus on clarity, not performance writing.`
    })

    if (hasImage) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      })
    }

    const geminiRequest = {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
        topP: 0.95,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            short_description: {
              type: "STRING",
            },
            full_description: {
              type: "STRING",
            },
            meta_title: {
              type: "STRING",
            },
            meta_description: {
              type: "STRING",
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
            benefits: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  icon: { type: "STRING" },
                  label: { type: "STRING" },
                  description: { type: "STRING" },
                },
              },
            },
            sku_suggestion: {
              type: "STRING",
            },
            weight_grams: {
              type: "NUMBER",
            },
          },
          required: [
            "short_description",
            "full_description",
            "meta_title",
            "meta_description",
            "tags",
            "benefits",
            "sku_suggestion",
            "weight_grams",
          ],
        },
        thinkingConfig: {
          thinkingLevel: "LOW",
        },
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "OFF",
        },
      ],
    }

    const geminiResponse = await fetch(
      `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiRequest),
      },
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error("Gemini API error:", errorText)

      if (hasImage && errorText.toLowerCase().includes("image")) {
        return jsonResponse(400, {
          success: false,
          message: "Image could not be processed. Try AI Fill without the image.",
        })
      }

      return jsonResponse(500, {
        success: false,
        message: "AI service unavailable. Please try again.",
      })
    }

    const reader = geminiResponse.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()
    let rawText = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      rawText += decoder.decode(value, { stream: true })
    }
    rawText += decoder.decode()

    let chunks: GeminiChunk[]
    try {
      chunks = parseStreamChunks(rawText)
    } catch (error) {
      console.error("Failed to parse Gemini stream:", rawText)
      throw new Error(error instanceof Error ? error.message : "Failed to parse AI response")
    }

    // Concatenate text from ALL chunks
    let allGeneratedText = ""

    for (const chunk of chunks) {
      const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        allGeneratedText += text
      }
    }

    if (!allGeneratedText) {
      throw new Error("No content in AI response")
    }

    let content: Record<string, unknown>
    try {
      content = JSON.parse(allGeneratedText) as Record<string, unknown>
    } catch {
      console.error(
        "Failed to parse concatenated content:",
        {
          fullText: allGeneratedText,
          chunkCount: chunks.length,
          lastChunkText: chunks[chunks.length - 1]
            ?.candidates?.[0]?.content?.parts?.[0]?.text,
        },
      )
      throw new Error("AI returned invalid content format")
    }

    return jsonResponse(200, {
      success: true,
      data: content,
      used_image: hasImage,
    })
  } catch (error) {
    console.error("ai_product_autofill error:", error)
    return jsonResponse(500, {
      success: false,
      message: "Something went wrong. Please try again.",
    })
  }
})
